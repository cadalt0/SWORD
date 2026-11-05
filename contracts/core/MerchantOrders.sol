// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import {ICollectorFactory} from "../interfaces/ICollectorFactory.sol";
import {IMerchantOrders} from "../interfaces/IMerchantOrders.sol";
import {OrderCollector} from "./OrderCollector.sol";

/// @title MerchantOrders
/// @notice One merchant's order book. The merchant signs one mandate at a time, naming its relayer and the limits for
///         orders, actions, and value. Creates orders and assigns each one a collector. A closed collector can be given
///         a new order later, after its previous assignment has been archived here.
/// @dev Holds no funds and moves no tokens. The merchant can act directly. The relayer acts within the mandate.
///      Archives are written in the same transaction as the reuse. No admin, upgrade, or pause paths.
contract MerchantOrders is IMerchantOrders, EIP712 {
    /// @notice Hard ceiling on orders in one mandate.
    uint256 public constant MAX_MANDATE_ORDERS = 10_000;

    /// @notice Hard ceiling on relayer actions in one mandate.
    uint256 public constant MAX_MANDATE_ACTIONS = 10_000;

    /// @notice Hard ceiling on value in one mandate, in USDT base units.
    uint256 public constant MAX_MANDATE_AMOUNT = 1_000_000_000;

    /// @notice Longest a mandate may run, from signing.
    uint256 public constant MAX_MANDATE_DURATION = 31 days;

    /// @notice Refund window used when none is given, in days.
    uint256 public constant DEFAULT_REFUND_DAYS = 7;

    /// @dev EIP-712 type hash of a mandate.
    bytes32 internal constant MANDATE_TYPEHASH = keccak256(
        "Mandate(address relayer,uint256 expiry,uint256 maxOrders,uint256 maxActions,uint256 maxAmount,uint256 nonce)"
    );

    /// @inheritdoc IMerchantOrders
    address public immutable usdt;

    /// @inheritdoc IMerchantOrders
    address public immutable merchant;

    /// @inheritdoc IMerchantOrders
    address public immutable spender;

    /// @inheritdoc IMerchantOrders
    address public immutable factory;

    /// @inheritdoc IMerchantOrders
    uint256 public nonce;

    /// @inheritdoc IMerchantOrders
    mapping(address collector => bool) public isCollector;

    /// @dev The current mandate.
    Mandate internal currentMandate;

    /// @dev Usage of the current mandate.
    MandateUsage internal currentUsage;

    /// @dev Current record of each order id.
    mapping(bytes32 orderId => OrderRecord) internal orders;

    /// @dev Archived assignments by collector and epoch.
    mapping(address collector => mapping(uint256 epoch => ArchivedOrder)) internal archives;

    /// @dev Restricts a function to the merchant.
    modifier onlyMerchant() {
        if (msg.sender != merchant) revert NotMerchant();
        _;
    }

    /// @notice Deploys the order book for one merchant, one settlement token, one spender, and one factory.
    /// @param usdt_ The USDT token address on this chain.
    /// @param merchant_ The merchant address that signs mandates and owns the book.
    /// @param spender_ The spender that moves funds for payments and withdrawn-order refunds.
    /// @param factory_ The factory that deploys collectors.
    constructor(address usdt_, address merchant_, address spender_, address factory_)
        EIP712("MerchantOrders", "2")
    {
        if (usdt_ == address(0) || merchant_ == address(0) || spender_ == address(0) || factory_ == address(0)) {
            revert ZeroAddress();
        }
        usdt = usdt_;
        merchant = merchant_;
        spender = spender_;
        factory = factory_;
    }

    /// @inheritdoc IMerchantOrders
    function setMandate(Mandate calldata mandate, bytes calldata signature) external {
        if (mandate.relayer == address(0)) revert ZeroAddress();
        if (mandate.nonce != nonce) revert InvalidNonce();
        if (mandate.expiry <= block.timestamp) revert MandateExpired();
        if (mandate.expiry > block.timestamp + MAX_MANDATE_DURATION) revert MandateTooLong();
        if (
            mandate.maxOrders > MAX_MANDATE_ORDERS || mandate.maxActions > MAX_MANDATE_ACTIONS
                || mandate.maxAmount > MAX_MANDATE_AMOUNT
        ) {
            revert MandateCapTooHigh();
        }

        bytes32 structHash = keccak256(
            abi.encode(
                MANDATE_TYPEHASH,
                mandate.relayer,
                mandate.expiry,
                mandate.maxOrders,
                mandate.maxActions,
                mandate.maxAmount,
                mandate.nonce
            )
        );
        if (ECDSA.recover(_hashTypedDataV4(structHash), signature) != merchant) revert InvalidSigner();

        currentMandate = mandate;
        delete currentUsage;

        emit MandateSet(mandate.relayer, mandate.expiry, mandate.maxOrders, mandate.maxActions, mandate.maxAmount);
    }

    /// @inheritdoc IMerchantOrders
    function createOrder(bytes32 orderId, uint256 amount, uint256 refundDays, address relayer)
        external
        returns (address collector)
    {
        if (relayer == address(0)) revert ZeroAddress();
        if (msg.sender != merchant) {
            if (msg.sender != relayer) revert NotAuthorized();
            _consume(msg.sender, 1, 0, 0);
        }
        if (amount == 0) revert ZeroAmount();
        if (orders[orderId].exists) revert OrderExists();

        collector = ICollectorFactory(factory).createCollector(
            usdt, merchant, relayer, address(this), spender, orderId, amount, _windowSeconds(refundDays)
        );
        isCollector[collector] = true;
        orders[orderId] = OrderRecord({amount: amount, collector: collector, exists: true, active: true});

        emit OrderCreated(orderId, collector, amount);
    }

    /// @inheritdoc IMerchantOrders
    function reuseCollector(address collector, bytes32 orderId, uint256 amount, uint256 refundDays) external {
        if (!isCollector[collector]) revert NotCollector();

        OrderCollector c = OrderCollector(collector);
        if (msg.sender != merchant) {
            if (msg.sender != c.relayer()) revert NotAuthorized();
            _consume(msg.sender, 1, 0, 0);
        }
        if (amount == 0) revert ZeroAmount();
        if (orders[orderId].exists) revert OrderExists();

        OrderCollector.State memory previous = c.getState();
        archives[collector][previous.epoch] = ArchivedOrder({
            orderId: previous.orderId,
            epoch: previous.epoch,
            amount: previous.amount,
            refundWindow: previous.refundWindow,
            payer: previous.payer,
            paidAt: previous.paidAt,
            paymentTxHash: previous.paymentTxHash,
            withdrawn: previous.withdrawn,
            settledAt: previous.settledAt,
            refundedAmount: previous.refundedAmount,
            refundStatus: uint8(previous.refundStatus),
            refundReasonHash: previous.refundReasonHash,
            closedAt: previous.closedAt
        });
        orders[previous.orderId].active = false;
        emit OrderArchived(collector, previous.epoch, previous.orderId);

        c.reset(orderId, amount, _windowSeconds(refundDays));

        orders[orderId] = OrderRecord({amount: amount, collector: collector, exists: true, active: true});
        emit CollectorReassigned(collector, previous.orderId, orderId, previous.epoch + 1);
    }

    /// @inheritdoc IMerchantOrders
    function consumeMandate(address caller, uint256 orderCount, uint256 actionCount, uint256 amount) external {
        if (msg.sender != spender && !isCollector[msg.sender]) revert NotCollector();
        _consume(caller, orderCount, actionCount, amount);
    }

    /// @inheritdoc IMerchantOrders
    function revoke() external onlyMerchant {
        uint256 newNonce = ++nonce;
        delete currentMandate;
        delete currentUsage;
        emit MandateRevoked(newNonce);
    }

    /// @inheritdoc IMerchantOrders
    function getOrder(bytes32 orderId) external view returns (OrderRecord memory) {
        return orders[orderId];
    }

    /// @inheritdoc IMerchantOrders
    function getMandate() external view returns (Mandate memory mandate, MandateUsage memory usage) {
        return (currentMandate, currentUsage);
    }

    /// @inheritdoc IMerchantOrders
    function getArchive(address collector, uint256 epoch) external view returns (ArchivedOrder memory) {
        return archives[collector][epoch];
    }

    /// @dev Checks that a relayer action is allowed by the current mandate, and counts it against the limits.
    function _consume(address caller, uint256 orderCount, uint256 actionCount, uint256 amount) private {
        if (currentMandate.relayer == address(0)) revert MandateNotSet();
        if (caller != currentMandate.relayer) revert NotAuthorized();
        if (currentMandate.nonce != nonce) revert InvalidNonce();
        if (block.timestamp > currentMandate.expiry) revert MandateExpired();

        MandateUsage storage u = currentUsage;
        if (
            u.orders + orderCount > currentMandate.maxOrders || u.actions + actionCount > currentMandate.maxActions
                || u.amount + amount > currentMandate.maxAmount
        ) {
            revert MandateLimitExceeded();
        }
        u.orders += orderCount;
        u.actions += actionCount;
        u.amount += amount;
    }

    /// @dev Converts a refund window in days to seconds, using the default when zero is given.
    function _windowSeconds(uint256 refundDays) private pure returns (uint256) {
        uint256 days_ = refundDays == 0 ? DEFAULT_REFUND_DAYS : refundDays;
        return days_ * 1 days;
    }
}
