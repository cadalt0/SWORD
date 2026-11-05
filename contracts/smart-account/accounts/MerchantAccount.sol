// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccountBase} from "../base/AccountBase.sol";
import {IMerchantOrders} from "../../interfaces/IMerchantOrders.sol";
import {IMerchantRegistryActions} from "../../interfaces/IMerchantRegistryActions.sol";
import {IMerchantSpender} from "../../interfaces/IMerchantSpender.sol";
import {IOrderCollectorActions} from "../../interfaces/IOrderCollectorActions.sol";

/// @title MerchantAccount
/// @notice The smart account of a merchant. The account is the merchant on chain: it registers, owns an order book,
///         and runs every merchant action. The owner runs them directly. The relayer runs them within the owner's
///         grant. Money actions count against the grant's amount: approving or paying refunds, sending extra funds,
///         and paying out subscription refunds. Creating orders, confirming payments, and charging slots move no
///         money out of the merchant's wallet, so they count nothing.
/// @dev The blueprint for merchant accounts. Accounts are copies of it, created by the account factory.
///      Anyone-callable actions (expire, refund a failed order, withdraw, close) need no account and are not wrapped.
contract MerchantAccount is AccountBase {
    /// @notice Status value of an approved refund in the collector's enum.
    uint8 internal constant REFUND_STATUS_APPROVED = 2;

    /// @notice The merchant's order book. Zero until the account registers.
    address public book;

    /// @notice Emitted when the account registers as a merchant.
    event MerchantRegistered(address indexed book);

    /// @notice Emitted when an approved refund is paid from the merchant's wallet through the account.
    event RefundPaidFromWallet(address indexed collector, uint256 amount);

    /// @notice Emitted when the account refunds a subscription.
    event SubscriptionRefundPaid(bytes32 indexed id, uint256 amount);

    error AlreadyRegistered();
    error NotRegistered();
    error RefundNotApproved();

    /// @dev Requires the account to have registered as a merchant.
    modifier registered() {
        if (book == address(0)) revert NotRegistered();
        _;
    }

    /// @notice Registers the account as a merchant and deploys its order book. Owner only, once.
    function register() external onlyOwner whenNotFrozen nonReentrant returns (address) {
        if (book != address(0)) revert AlreadyRegistered();

        book = IMerchantRegistryActions(registry).register();
        emit MerchantRegistered(book);
        return book;
    }

    // ---------------------------------------------------------------- orders

    /// @notice Creates an order in the account's book. Orders are operated by the account's relayer.
    /// @param orderId The order id, from the merchant's reference.
    /// @param amount The exact amount due.
    /// @param refundDays Refund window in days. Zero uses the default.
    /// @return collector The collector that holds the order.
    function createOrder(bytes32 orderId, uint256 amount, uint256 refundDays)
        external
        registered
        whenNotFrozen
        nonReentrant
        returns (address collector)
    {
        _authorize(0);
        collector = IMerchantOrders(book).createOrder(orderId, amount, refundDays, relayer);
    }

    /// @notice Gives a closed collector a new order. The contract archives the previous order in the same transaction.
    /// @param collector The closed collector.
    /// @param orderId The new order id.
    /// @param amount The exact amount due.
    /// @param refundDays Refund window in days. Zero uses the default.
    function reuseOrder(address collector, bytes32 orderId, uint256 amount, uint256 refundDays)
        external
        registered
        whenNotFrozen
        nonReentrant
    {
        _authorize(0);
        IMerchantOrders(book).reuseCollector(collector, orderId, amount, refundDays);
    }

    /// @notice Confirms a plain USDT transfer as the payment for an order. Moves no money.
    /// @param collector The order's collector.
    /// @param payer The address that sent the USDT.
    /// @param transferTime Block time of the transfer, in seconds.
    /// @param txHash Hash of the transfer transaction.
    function confirmTransfer(address collector, address payer, uint256 transferTime, bytes32 txHash)
        external
        whenNotFrozen
        nonReentrant
    {
        _authorize(0);
        IOrderCollectorActions(collector).markPaid(payer, transferTime, txHash);
    }

    /// @notice Marks an open order as failed, before withdrawal. Moves no money.
    /// @param collector The order's collector.
    function failOrder(address collector) external whenNotFrozen nonReentrant {
        _authorize(0);
        IOrderCollectorActions(collector).failOrder();
    }

    /// @notice Changes an order's refund window, until withdrawal. Moves no money.
    /// @param collector The order's collector.
    /// @param refundDays The new window in days, from 1 to 365.
    function setRefundWindow(address collector, uint256 refundDays) external whenNotFrozen nonReentrant {
        _authorize(0);
        IOrderCollectorActions(collector).setRefundWindow(refundDays);
    }

    // ---------------------------------------------------------------- refunds on orders

    /// @notice Approves a refund amount on an open customer request. Counts the amount against the grant.
    /// @param collector The order's collector.
    /// @param amount The amount to approve.
    function approveRefund(address collector, uint256 amount) external whenNotFrozen nonReentrant {
        _authorize(amount);
        IOrderCollectorActions(collector).approveRefund(amount);
    }

    /// @notice Starts a refund without a customer request, approved at `amount`. Counts the amount against the grant.
    ///         Pay it next with `executeRefundFromBalance` or `payRefundFromWallet`.
    /// @param collector The order's collector.
    /// @param amount The amount to approve.
    /// @param noteHash Hash of the merchant's reason.
    function initiateRefund(address collector, uint256 amount, bytes32 noteHash) external whenNotFrozen nonReentrant {
        _authorize(amount);
        IOrderCollectorActions(collector).initiateRefund(amount, noteHash);
    }

    /// @notice Denies an open customer request. Moves no money.
    /// @param collector The order's collector.
    /// @param noteHash Hash of the merchant's note.
    function denyRefund(address collector, bytes32 noteHash) external whenNotFrozen nonReentrant {
        _authorize(0);
        IOrderCollectorActions(collector).denyRefund(noteHash);
    }

    /// @notice Pays an approved refund from the order's own balance, before withdrawal. Counts the approved amount.
    /// @param collector The order's collector.
    function executeRefundFromBalance(address collector) external whenNotFrozen nonReentrant {
        uint256 approved = _approvedRefund(collector);
        _authorize(approved);
        IOrderCollectorActions(collector).executeRefund();
    }

    /// @notice Pays an approved refund from the merchant's wallet, through the spender, after withdrawal.
    ///         Counts the approved amount. The spender's approval is raised for it first.
    /// @param collector The order's collector.
    function payRefundFromWallet(address collector) external whenNotFrozen nonReentrant {
        uint256 approved = _approvedRefund(collector);
        _authorize(approved);

        _raiseSpenderApproval(approved);
        IMerchantSpender(spender).pullRefund(collector);
        emit RefundPaidFromWallet(collector, approved);
    }

    /// @notice Records a refund the account sent from its own wallet, after withdrawal. Moves no money. The USDT
    ///         itself is sent with `sendUsdt`, which counts against the grant.
    /// @param collector The order's collector.
    /// @param amount The amount sent to the payer.
    function recordManualRefund(address collector, uint256 amount) external whenNotFrozen nonReentrant {
        _authorize(0);
        IOrderCollectorActions(collector).recordRefund(amount);
    }

    /// @notice Sends extra or stray funds in an order's balance to an address. Counts the amount against the grant.
    /// @param collector The order's collector.
    /// @param to The recipient.
    /// @param amount The amount to send.
    function refundExtra(address collector, address to, uint256 amount) external whenNotFrozen nonReentrant {
        _authorize(amount);
        IOrderCollectorActions(collector).refundTo(to, amount);
    }

    // ---------------------------------------------------------------- subscriptions

    /// @notice Creates a subscription the account sells, with its own deposit address. One customer takes it later.
    ///         Moves no money, so it counts nothing.
    /// @param ref The account's own reference, hashed.
    /// @param amount Amount per period.
    /// @param periodLength Length of one period, in seconds.
    /// @param periods Number of periods.
    /// @return id The subscription id.
    function createSubscription(bytes32 ref, uint256 amount, uint256 periodLength, uint256 periods)
        external
        whenNotFrozen
        nonReentrant
        returns (bytes32 id)
    {
        _authorize(0);
        id = IMerchantSpender(spender).createSubscription(ref, address(this), relayer, amount, periodLength, periods);
    }

    /// @notice Pulls the next due period of a subscription the account sells into its vault. Counts nothing.
    /// @param id The subscription id.
    function chargeSubscription(bytes32 id) external whenNotFrozen nonReentrant {
        _authorize(0);
        IMerchantSpender(spender).chargeNext(id);
    }

    /// @notice Cancels a subscription the account sells. Moves no money.
    /// @param id The subscription id.
    function cancelSubscription(bytes32 id) external whenNotFrozen nonReentrant {
        _authorize(0);
        IMerchantSpender(spender).cancelSubscription(id);
    }

    /// @notice Refunds any amount on a subscription the account sells. Paid from the subscription's vault first; any
    ///         rest comes from the account, so the spender's approval is raised by exactly that rest. Counts the full
    ///         amount against the grant.
    /// @param id The subscription id.
    /// @param amount The amount to refund.
    /// @param noteHash Hash of the merchant's note.
    function refundSubscription(bytes32 id, uint256 amount, bytes32 noteHash) external whenNotFrozen nonReentrant {
        _authorize(amount);
        uint256 held = IMerchantSpender(spender).heldBalance(id);
        if (amount > held) _raiseSpenderApproval(amount - held);
        IMerchantSpender(spender).refundSubscription(id, amount, noteHash);
        emit SubscriptionRefundPaid(id, amount);
    }

    /// @notice Denies the open refund request on a subscription the account sells. Moves no money.
    /// @param id The subscription id.
    /// @param noteHash Hash of the merchant's note.
    function denySubscriptionRefund(bytes32 id, bytes32 noteHash) external whenNotFrozen nonReentrant {
        _authorize(0);
        IMerchantSpender(spender).denySubscriptionRefund(id, noteHash);
    }

    /// @notice Moves a subscription's held funds into the account. Counts nothing: the money only comes in.
    /// @param id The subscription id.
    function withdrawSubscription(bytes32 id) external whenNotFrozen nonReentrant {
        _authorize(0);
        IMerchantSpender(spender).withdrawSubscription(id);
    }

    /// @dev Returns the approved refund amount of an order, and reverts unless a refund is approved.
    function _approvedRefund(address collector) private view returns (uint256) {
        (, uint8 status,, uint256 approved) = IOrderCollectorActions(collector).pullInfo();
        if (status != REFUND_STATUS_APPROVED) revert RefundNotApproved();
        return approved;
    }
}
