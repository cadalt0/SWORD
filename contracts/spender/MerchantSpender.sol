// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IMerchantOrders} from "../interfaces/IMerchantOrders.sol";
import {IMerchantRegistry} from "../interfaces/IMerchantRegistry.sol";
import {IOrderCollector} from "../interfaces/IOrderCollector.sol";
import {SubscriptionVault} from "./SubscriptionVault.sol";

/// @title MerchantSpender
/// @notice Single shared contract that moves USDT for orders and subscriptions.
///         Orders: pays an open order into its collector, and pays refunds on withdrawn orders from the merchant.
///         Subscriptions: each subscription is created by the merchant, like an order, and has its own deposit address
///         (a vault). Exactly one customer takes it. Taking it is the customer's consent, and the first period is paid
///         at once. Each later period is pulled into the vault when due. The merchant withdraws from the vault, and can
///         refund any amount at any time, from the vault first and from its own wallet for the rest.
/// @dev Holds no funds itself. Customers and merchants approve this contract for a token amount. No admin, upgrade, or
///      pause paths.
contract MerchantSpender is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Shortest allowed period, in seconds.
    uint256 public constant MIN_PERIOD = 1 days;

    /// @notice Longest allowed period, in seconds.
    uint256 public constant MAX_PERIOD = 365 days;

    /// @notice Most periods a subscription can have.
    uint256 public constant MAX_PERIODS = 120;

    /// @dev Refund status value of `Approved` in the collector's status enum.
    uint8 internal constant REFUND_STATUS_APPROVED = 2;

    /// @notice Status of a subscription, derived from its record.
    /// @dev `Open`: created, waiting for its customer. `Active`: taken, more periods to pay. `Cancelled`: cancelled by the
    ///      customer, the merchant, or the relayer. `Completed`: every period paid.
    enum SubStatus {
        Open,
        Active,
        Cancelled,
        Completed
    }

    /// @notice Stored state of a subscription.
    /// @param merchant Payee, and the merchant allowed to act on it.
    /// @param relayer The relayer allowed to charge, cancel, and withdraw.
    /// @param subscriber The customer who took it. Zero until taken.
    /// @param vault The subscription's deposit address.
    /// @param amount Amount per period, in token base units.
    /// @param periodLength Length of one period, in seconds.
    /// @param periods Number of periods.
    /// @param paidPeriods Periods paid so far. Periods are paid in order.
    /// @param createdAt Time it was created.
    /// @param startedAt Time it was taken. Period 0 starts here.
    /// @param cancelledAt Time of cancellation, if cancelled.
    /// @param exists True once created.
    /// @param cancelled True once cancelled. Periods already paid still run to their end.
    /// @param refundRequested True while a customer refund request is open.
    /// @param collected Total pulled from the customer.
    /// @param refunded Total refunded to the customer.
    /// @param withdrawn Total the merchant has withdrawn from the vault.
    /// @param requestedAmount Amount the customer asked for in the open request. Recorded only.
    /// @param requestReasonHash Hash of the customer's reason for the open request.
    struct Subscription {
        address merchant;
        address relayer;
        address subscriber;
        address vault;
        uint256 amount;
        uint64 periodLength;
        uint32 periods;
        uint32 paidPeriods;
        uint64 createdAt;
        uint64 startedAt;
        uint64 cancelledAt;
        bool exists;
        bool cancelled;
        bool refundRequested;
        uint256 collected;
        uint256 refunded;
        uint256 withdrawn;
        uint256 requestedAmount;
        bytes32 requestReasonHash;
    }

    /// @notice Emitted when a merchant creates a subscription.
    event SubscriptionCreated(
        bytes32 indexed id, address indexed merchant, address vault, uint256 amount, uint256 periodLength, uint256 periods
    );

    /// @notice Emitted when a customer takes a subscription.
    event SubscriptionStarted(bytes32 indexed id, address indexed subscriber);

    /// @notice Emitted when a period is paid into the subscription's vault.
    event PeriodPaid(bytes32 indexed id, uint256 index, uint256 amount, uint256 periodStart, uint256 periodEnd);

    /// @notice Emitted when a subscription is cancelled.
    event SubscriptionCancelled(bytes32 indexed id, address indexed by, uint64 cancelledAt);

    /// @notice Emitted when the customer asks for a refund.
    event SubscriptionRefundRequested(bytes32 indexed id, address indexed subscriber, uint256 requestedAmount, bytes32 reasonHash);

    /// @notice Emitted when the merchant denies an open refund request.
    event SubscriptionRefundDenied(bytes32 indexed id, bytes32 noteHash);

    /// @notice Emitted when a refund is paid to the customer.
    /// @param fromVault The part paid from the subscription's vault. The rest came from the merchant's wallet.
    event SubscriptionRefunded(bytes32 indexed id, address indexed subscriber, uint256 amount, uint256 fromVault, bytes32 noteHash);

    /// @notice Emitted when the merchant withdraws a subscription's held funds.
    event SubscriptionWithdrawn(bytes32 indexed id, address indexed merchant, uint256 amount);

    /// @notice Emitted when a customer pays an order through the spender.
    event OrderPaid(address indexed collector, address indexed payer, uint256 amount);

    /// @notice Emitted when a refund on a withdrawn order is paid from the merchant's wallet.
    event RefundPulled(address indexed collector, address indexed payer, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    /// @notice The period length or number of periods is outside the allowed range.
    error InvalidPeriods();
    error NotAuthorized();
    /// @notice The caller is not the subscription's customer.
    error NotSubscriber();
    /// @notice The customer's approval to this contract is smaller than the subscription total.
    error InsufficientAllowance();
    error SubscriptionExists();
    error SubscriptionNotFound();
    /// @notice Another customer already took this subscription.
    error AlreadyTaken();
    /// @notice No customer has taken this subscription yet.
    error NotStarted();
    error SubscriptionIsCancelled();
    error AlreadyCancelled();
    /// @notice Every period is paid, so there is nothing left to cancel.
    error NotCancellable();
    error PeriodNotDue();
    error AllPeriodsPaid();
    error RefundAlreadyOpen();
    error NoRefundRequest();
    /// @notice The refund is larger than what the customer paid less what was refunded.
    error RefundTooLarge();
    error NothingToWithdraw();
    error UnknownCollector();
    error UnknownBook();
    error OrderNotOpen();
    error NotWithdrawn();
    error NotApproved();

    /// @notice The USDT token this spender moves.
    address public immutable usdt;

    /// @notice The registry used to find merchant books.
    address public immutable registry;

    /// @notice The vault implementation every subscription vault is cloned from.
    address public immutable vaultImplementation;

    /// @dev Subscription records by id.
    mapping(bytes32 id => Subscription) internal subs;

    /// @notice Payment time of each paid period, by subscription and period index. Zero if not paid.
    mapping(bytes32 id => mapping(uint256 index => uint64)) public periodPaidAt;

    /// @param usdt_ The USDT token address.
    /// @param registry_ The merchant registry address.
    constructor(address usdt_, address registry_) {
        if (usdt_ == address(0) || registry_ == address(0)) revert ZeroAddress();
        usdt = usdt_;
        registry = registry_;
        vaultImplementation = address(new SubscriptionVault());
    }

    // ---------------------------------------------------------------- subscriptions

    /// @notice The id a merchant's subscription gets for its reference. The same value `createSubscription` returns.
    function subscriptionIdOf(address merchant, bytes32 ref) public pure returns (bytes32) {
        return keccak256(abi.encode(merchant, ref));
    }

    /// @notice The deposit address of a subscription. Known before the subscription is created.
    function vaultOf(bytes32 id) public view returns (address) {
        return Clones.predictDeterministicAddress(vaultImplementation, id);
    }

    /// @notice Creates a subscription, like an order: its terms and its own deposit address. One customer takes it later.
    ///         Callable by the merchant, or by the relayer within the merchant's mandate (it counts as one order).
    /// @param ref The merchant's own reference, hashed. The id is derived from it and the merchant.
    /// @param merchant The merchant that is paid.
    /// @param relayer_ The relayer allowed to charge, cancel, and withdraw.
    /// @param amount Amount per period, in token base units.
    /// @param periodLength Length of one period, in seconds.
    /// @param periods Number of periods.
    /// @return id The subscription id.
    function createSubscription(
        bytes32 ref,
        address merchant,
        address relayer_,
        uint256 amount,
        uint256 periodLength,
        uint256 periods
    ) external returns (bytes32 id) {
        if (merchant == address(0) || relayer_ == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (periodLength < MIN_PERIOD || periodLength > MAX_PERIOD || periods == 0 || periods > MAX_PERIODS) {
            revert InvalidPeriods();
        }
        address book = IMerchantRegistry(registry).bookOf(merchant);
        if (book == address(0)) revert UnknownBook();
        if (msg.sender != merchant) {
            if (msg.sender != relayer_) revert NotAuthorized();
            IMerchantOrders(book).consumeMandate(msg.sender, 1, 0, 0);
        }

        id = subscriptionIdOf(merchant, ref);
        if (subs[id].exists) revert SubscriptionExists();

        address vault = Clones.cloneDeterministic(vaultImplementation, id);
        Subscription storage s = subs[id];
        s.merchant = merchant;
        s.relayer = relayer_;
        s.vault = vault;
        s.amount = amount;
        s.periodLength = uint64(periodLength);
        s.periods = uint32(periods);
        s.createdAt = uint64(block.timestamp);
        s.exists = true;

        emit SubscriptionCreated(id, merchant, vault, amount, periodLength, periods);
    }

    /// @notice Takes an open subscription. The caller becomes its only customer, and the first period is paid into the
    ///         vault at once. The caller must have approved this contract for at least the subscription total; that
    ///         approval and this transaction are the customer's consent to every period.
    /// @param id The subscription id.
    function subscribe(bytes32 id) external nonReentrant {
        Subscription storage s = _existing(id);
        if (s.cancelled) revert SubscriptionIsCancelled();
        if (s.subscriber != address(0)) revert AlreadyTaken();
        if (IERC20(usdt).allowance(msg.sender, address(this)) < s.amount * s.periods) revert InsufficientAllowance();

        s.subscriber = msg.sender;
        s.startedAt = uint64(block.timestamp);
        emit SubscriptionStarted(id, msg.sender);

        _charge(id, s);
    }

    /// @notice Pulls the next period's payment into the vault, once it is due. Callable by the merchant or the relayer.
    /// @param id The subscription id.
    function chargeNext(bytes32 id) external nonReentrant {
        Subscription storage s = _existing(id);
        if (msg.sender != s.merchant && msg.sender != s.relayer) revert NotAuthorized();
        if (s.subscriber == address(0)) revert NotStarted();
        if (s.cancelled) revert SubscriptionIsCancelled();
        if (s.paidPeriods >= s.periods) revert AllPeriodsPaid();
        if (block.timestamp < uint256(s.startedAt) + uint256(s.paidPeriods) * s.periodLength) revert PeriodNotDue();

        _charge(id, s);
    }

    /// @notice Cancels a subscription. No further periods are charged; periods already paid run to their end.
    ///         Callable by the customer, the merchant, or the relayer. An open subscription can be cancelled too.
    /// @param id The subscription id.
    function cancelSubscription(bytes32 id) external {
        Subscription storage s = _existing(id);
        if (msg.sender != s.merchant && msg.sender != s.relayer && (s.subscriber == address(0) || msg.sender != s.subscriber)) {
            revert NotAuthorized();
        }
        if (s.cancelled) revert AlreadyCancelled();
        if (s.subscriber != address(0) && s.paidPeriods == s.periods) revert NotCancellable();

        s.cancelled = true;
        s.cancelledAt = uint64(block.timestamp);
        emit SubscriptionCancelled(id, msg.sender, s.cancelledAt);
    }

    /// @notice The customer asks for a refund, at any time after paying. The amount is recorded only; the merchant
    ///         chooses what to refund.
    /// @param id The subscription id.
    /// @param reasonHash Hash of the reason.
    /// @param requestedAmount The amount asked for.
    function requestSubscriptionRefund(bytes32 id, bytes32 reasonHash, uint256 requestedAmount) external {
        Subscription storage s = _existing(id);
        if (s.subscriber == address(0) || msg.sender != s.subscriber) revert NotSubscriber();
        if (s.refundRequested) revert RefundAlreadyOpen();
        if (requestedAmount == 0) revert ZeroAmount();
        if (s.collected - s.refunded == 0) revert RefundTooLarge();

        s.refundRequested = true;
        s.requestedAmount = requestedAmount;
        s.requestReasonHash = reasonHash;
        emit SubscriptionRefundRequested(id, msg.sender, requestedAmount, reasonHash);
    }

    /// @notice Refunds any amount to the customer, at any time, with or without a request: one period, several, or
    ///         everything paid. Paid from the vault first, and from the merchant's wallet for the rest (which needs the
    ///         merchant's approval to this contract). Closes an open request. Callable by the merchant directly, or by
    ///         the relayer within the merchant's mandate.
    /// @param id The subscription id.
    /// @param amount The amount to refund.
    /// @param noteHash Hash of the merchant's note.
    function refundSubscription(bytes32 id, uint256 amount, bytes32 noteHash) external nonReentrant {
        Subscription storage s = _existing(id);
        _authorizeMerchant(s, amount);
        if (s.subscriber == address(0)) revert NotStarted();
        if (amount == 0) revert ZeroAmount();
        if (amount > s.collected - s.refunded) revert RefundTooLarge();

        s.refunded += amount;
        _clearRequest(s);

        uint256 held = IERC20(usdt).balanceOf(s.vault);
        uint256 fromVault = held < amount ? held : amount;
        if (fromVault > 0) SubscriptionVault(s.vault).pay(usdt, s.subscriber, fromVault);
        if (amount > fromVault) IERC20(usdt).safeTransferFrom(s.merchant, s.subscriber, amount - fromVault);

        emit SubscriptionRefunded(id, s.subscriber, amount, fromVault, noteHash);
    }

    /// @notice Denies the open refund request. The customer may ask again. Callable by the merchant, or by the relayer
    ///         within the merchant's mandate.
    /// @param id The subscription id.
    /// @param noteHash Hash of the merchant's note.
    function denySubscriptionRefund(bytes32 id, bytes32 noteHash) external {
        Subscription storage s = _existing(id);
        _authorizeMerchant(s, 0);
        if (!s.refundRequested) revert NoRefundRequest();
        _clearRequest(s);
        emit SubscriptionRefundDenied(id, noteHash);
    }

    /// @notice Moves everything held in the subscription's vault to the merchant. Callable by the merchant or the relayer;
    ///         the money can only go to the merchant.
    /// @param id The subscription id.
    function withdrawSubscription(bytes32 id) external nonReentrant {
        Subscription storage s = _existing(id);
        if (msg.sender != s.merchant && msg.sender != s.relayer) revert NotAuthorized();
        uint256 held = IERC20(usdt).balanceOf(s.vault);
        if (held == 0) revert NothingToWithdraw();

        s.withdrawn += held;
        SubscriptionVault(s.vault).pay(usdt, s.merchant, held);
        emit SubscriptionWithdrawn(id, s.merchant, held);
    }

    /// @notice Returns the stored record of a subscription.
    function getSubscription(bytes32 id) external view returns (Subscription memory) {
        return subs[id];
    }

    /// @notice The amount per period and the number of periods. Used by customer accounts to size their approval.
    function subscriptionTerms(bytes32 id) external view returns (uint256 amount, uint256 periods) {
        Subscription storage s = _existing(id);
        return (s.amount, s.periods);
    }

    /// @notice What the subscription's vault holds right now.
    function heldBalance(bytes32 id) external view returns (uint256) {
        return IERC20(usdt).balanceOf(_existing(id).vault);
    }

    /// @notice The current status of a subscription.
    function subscriptionStatus(bytes32 id) public view returns (SubStatus) {
        Subscription storage s = _existing(id);
        if (s.cancelled) return SubStatus.Cancelled;
        if (s.subscriber == address(0)) return SubStatus.Open;
        if (s.paidPeriods == s.periods) return SubStatus.Completed;
        return SubStatus.Active;
    }

    /// @notice Whether the customer has paid access at a given time: from the start until the end of the last paid
    ///         period, even after cancellation.
    function hasAccess(bytes32 id, uint256 at) external view returns (bool) {
        Subscription storage s = subs[id];
        if (!s.exists || s.paidPeriods == 0) return false;
        return at >= s.startedAt && at < uint256(s.startedAt) + uint256(s.paidPeriods) * s.periodLength;
    }

    // ---------------------------------------------------------------- orders

    /// @notice Pays an open order. The customer's full order amount moves into the order's collector, and the collector
    ///         records the customer as the payer. Reverts if the order is closed, failed, or past its payment window.
    /// @param collector The order's collector.
    function payOrder(address collector) external nonReentrant {
        IOrderCollector c = IOrderCollector(collector);
        if (c.spender() != address(this)) revert UnknownCollector();

        address book = c.book();
        if (book == address(0) || IMerchantRegistry(registry).bookOf(c.merchant()) != book) revert UnknownBook();

        (bool open, uint256 amount) = c.payInfo();
        if (!open) revert OrderNotOpen();

        IERC20(usdt).safeTransferFrom(msg.sender, collector, amount);
        c.recordPayment(msg.sender);

        emit OrderPaid(collector, msg.sender, amount);
    }

    /// @notice Pays an approved refund on a withdrawn order from the merchant's wallet to the customer, and records it
    ///         on the collector in the same transaction. Callable by the merchant or relayer of the collector.
    /// @param collector The order's collector.
    function pullRefund(address collector) external nonReentrant {
        IOrderCollector c = IOrderCollector(collector);
        address merchant = c.merchant();
        if (msg.sender != merchant && msg.sender != c.relayer()) revert NotAuthorized();
        if (c.spender() != address(this)) revert UnknownCollector();

        address book = c.book();
        if (book == address(0) || IMerchantRegistry(registry).bookOf(merchant) != book) revert UnknownBook();

        (bool withdrawn, uint8 status, address payer, uint256 approved) = c.pullInfo();
        if (!withdrawn) revert NotWithdrawn();
        if (status != REFUND_STATUS_APPROVED) revert NotApproved();

        IERC20(usdt).safeTransferFrom(merchant, payer, approved);
        c.settleWithdrawnRefund();

        emit RefundPulled(collector, payer, approved);
    }

    // ---------------------------------------------------------------- internal

    /// @dev Records the next period as paid and pulls its amount from the customer into the vault.
    function _charge(bytes32 id, Subscription storage s) private {
        uint256 index = s.paidPeriods;
        uint256 periodStart = uint256(s.startedAt) + index * s.periodLength;
        s.paidPeriods = uint32(index + 1);
        s.collected += s.amount;
        periodPaidAt[id][index] = uint64(block.timestamp);

        IERC20(usdt).safeTransferFrom(s.subscriber, s.vault, s.amount);
        emit PeriodPaid(id, index, s.amount, periodStart, periodStart + s.periodLength);
    }

    /// @dev The merchant acts freely. The relayer acts only within the merchant's mandate, which counts one action and
    ///      `amount` of value.
    function _authorizeMerchant(Subscription storage s, uint256 amount) private {
        if (msg.sender == s.merchant) return;
        if (msg.sender != s.relayer) revert NotAuthorized();
        address book = IMerchantRegistry(registry).bookOf(s.merchant);
        if (book == address(0)) revert UnknownBook();
        IMerchantOrders(book).consumeMandate(msg.sender, 0, 1, amount);
    }

    function _clearRequest(Subscription storage s) private {
        s.refundRequested = false;
        s.requestedAmount = 0;
        s.requestReasonHash = bytes32(0);
    }

    /// @dev Returns a subscription record, reverting if it doesn't exist.
    function _existing(bytes32 id) private view returns (Subscription storage s) {
        s = subs[id];
        if (!s.exists) revert SubscriptionNotFound();
    }
}
