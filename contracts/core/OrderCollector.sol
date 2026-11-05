// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IMerchantOrders} from "../interfaces/IMerchantOrders.sol";
import {IOrderCollector} from "../interfaces/IOrderCollector.sol";

/// @title OrderCollector
/// @notice Holds the USDT for one order at a time. Records the payment, moves the order through its lifecycle,
///         and handles refunds, partial refunds, and extra funds. Reused for new orders after it has been closed
///         and archived.
/// @dev Lifecycle: Open (accepting payment for 20 minutes), Paid (payment recorded), PartiallyRefunded (some refunded),
///      Refunded (fully refunded), Failed (expired, or cancelled by the merchant), Closed (finished, ready for reuse).
///      Withdrawal is allowed only when the balance holds no extra beyond what is still owed. Extra money can be refunded
///      only on paid or completed orders, and only the part above what is owed. Each relayer action is checked against
///      the merchant's mandate in the book. The merchant acts directly with no mandate check.
contract OrderCollector is IOrderCollector {
    using SafeERC20 for IERC20;

    /// @notice How long an order stays open for payment after it is created or reused.
    uint256 public constant ORDER_TTL = 20 minutes;

    /// @notice Shortest allowed refund window, in seconds.
    uint256 public constant MIN_REFUND_WINDOW = 1 days;

    /// @notice Longest allowed refund window, in seconds.
    uint256 public constant MAX_REFUND_WINDOW = 365 days;

    /// @notice How long a closed collector waits before it can be reused for a new order.
    uint256 public constant REUSE_DELAY = 30 days;

    /// @notice Lifecycle status of the current assignment.
    enum OrderStatus {
        Open,
        Paid,
        PartiallyRefunded,
        Refunded,
        Failed,
        Closed
    }

    /// @notice Refund request state.
    /// @dev `None`: no open request. `Requested`: awaiting merchant decision. `Approved`: merchant approved an amount,
    ///      not yet executed. `Denied`: merchant denied; the payer may request again.
    enum RefundStatus {
        None,
        Requested,
        Approved,
        Denied
    }

    /// @notice Full state of the current assignment.
    /// @param orderId The order id served by this assignment.
    /// @param amount The exact amount due.
    /// @param epoch The assignment number.
    /// @param expiresAt Time after which the order no longer accepts payment.
    /// @param refundWindow Refund window in seconds, counted from settlement.
    /// @param status Lifecycle status.
    /// @param payer The customer who paid; zero while unpaid.
    /// @param paidAt Time the payment was recorded.
    /// @param paymentTxHash Hash of the transfer, for plain-transfer payments.
    /// @param withdrawn True once the balance has been withdrawn to the merchant.
    /// @param settledAt Time of withdrawal, or of full refund, whichever came first.
    /// @param closedAt Time the assignment was closed.
    /// @param refundedAmount Total refunded in this assignment.
    /// @param refundStatus Current refund request state.
    /// @param refundRequestedAmount Amount the customer stated in the latest request. Recorded only.
    /// @param refundApprovedAmount Amount the merchant approved for the current refund.
    /// @param refundReasonHash Hash of the off-chain reason for the latest refund request.
    struct State {
        bytes32 orderId;
        uint256 amount;
        uint256 epoch;
        uint64 expiresAt;
        uint64 refundWindow;
        OrderStatus status;
        address payer;
        uint64 paidAt;
        bytes32 paymentTxHash;
        bool withdrawn;
        uint64 settledAt;
        uint64 closedAt;
        uint256 refundedAmount;
        RefundStatus refundStatus;
        uint256 refundRequestedAmount;
        uint256 refundApprovedAmount;
        bytes32 refundReasonHash;
    }

    /// @notice Emitted when a payment is recorded. This is the on-chain receipt.
    /// @param orderId The paid order.
    /// @param payer The customer who paid.
    /// @param amount The exact order amount received.
    /// @param txHash Hash of the transfer for plain-transfer payments; zero for payments through the spender.
    event PaymentReceived(bytes32 indexed orderId, address indexed payer, uint256 amount, bytes32 txHash);

    /// @notice Emitted when the order is marked failed.
    /// @param orderId The failed order.
    event OrderFailed(bytes32 indexed orderId);

    /// @notice Emitted when the balance of a failed order is refunded to its payer.
    /// @param orderId The order.
    /// @param payer The payer receiving the refund.
    /// @param amount Amount refunded.
    event FailedOrderRefunded(bytes32 indexed orderId, address indexed payer, uint256 amount);

    /// @notice Emitted when funds are refunded to an address directly: stray funds on an unpaid order, or extra funds
    ///         on a paid order.
    /// @param orderId The order.
    /// @param to The address receiving the refund.
    /// @param amount Amount refunded.
    event FundsRefunded(bytes32 indexed orderId, address indexed to, uint256 amount);

    /// @notice Emitted when the balance is withdrawn to the merchant.
    /// @param orderId The order withdrawn.
    /// @param amount Amount sent to the merchant.
    event Withdrawn(bytes32 indexed orderId, uint256 amount);

    /// @notice Emitted when the refund window is changed.
    /// @param orderId The order.
    /// @param refundWindow The new window in seconds.
    event RefundWindowSet(bytes32 indexed orderId, uint64 refundWindow);

    /// @notice Emitted when the assignment is closed.
    /// @param orderId The closed order.
    /// @param closedAt Time of closing.
    event OrderClosed(bytes32 indexed orderId, uint64 closedAt);

    /// @notice Emitted when the collector is given a new order.
    /// @param orderId The new order id.
    /// @param epoch The new assignment number.
    /// @param amount The new amount due.
    /// @param expiresAt The new payment deadline.
    event OrderReset(bytes32 indexed orderId, uint256 epoch, uint256 amount, uint64 expiresAt);

    /// @notice Emitted when the payer opens a refund request.
    /// @param orderId The order.
    /// @param payer The requesting payer.
    /// @param requestedAmount The amount the customer stated. Recorded only.
    /// @param reasonHash Hash of the off-chain reason text.
    event RefundRequested(
        bytes32 indexed orderId, address indexed payer, uint256 requestedAmount, bytes32 reasonHash
    );

    /// @notice Emitted when the merchant approves a refund amount.
    /// @param orderId The order.
    /// @param amount The approved amount.
    event RefundApproved(bytes32 indexed orderId, uint256 amount);

    /// @notice Emitted when the merchant starts a refund without a customer request.
    /// @param orderId The order.
    /// @param amount The approved amount.
    /// @param noteHash Hash of the merchant's off-chain reason.
    event RefundInitiated(bytes32 indexed orderId, uint256 amount, bytes32 noteHash);

    /// @notice Emitted when the merchant denies the open refund request.
    /// @param orderId The order.
    /// @param noteHash Hash of the merchant's off-chain note.
    event RefundDenied(bytes32 indexed orderId, bytes32 noteHash);

    /// @notice Emitted when an approved refund has been paid and recorded.
    /// @param orderId The order.
    /// @param payer The address that received the refund.
    /// @param amount Refund amount.
    /// @param fromMerchantWallet True if paid from the merchant's wallet through the spender, false if from this contract.
    event RefundExecuted(bytes32 indexed orderId, address indexed payer, uint256 amount, bool fromMerchantWallet);

    /// @notice Emitted when the merchant records a refund they paid directly from their own wallet.
    /// @param orderId The order.
    /// @param amount Amount recorded as refunded.
    event RefundRecorded(bytes32 indexed orderId, uint256 amount);

    /// @notice A constructor argument was the zero address.
    error ZeroAddress();
    /// @notice An amount argument was zero.
    error ZeroAmount();
    /// @notice An order id argument was zero.
    error ZeroOrderId();
    /// @notice The refund window is outside the allowed range.
    error InvalidRefundWindow();
    /// @notice The caller is not the merchant.
    error NotMerchant();
    /// @notice The caller is neither the merchant nor the relayer.
    error NotAuthorized();
    /// @notice The caller is not the spender.
    error NotSpender();
    /// @notice The caller is not the book.
    error NotBook();
    /// @notice The caller is not the order's payer.
    error NotPayer();
    /// @notice The order is not open for payment.
    error NotOpen();
    /// @notice The order's payment window has passed.
    error OrderExpired();
    /// @notice The order has not expired yet.
    error NotExpired();
    /// @notice The order is not in a state that allows this action.
    error InvalidStatus();
    /// @notice The order has not been paid.
    error NotPaid();
    /// @notice The payer is not known for this order.
    error NoPayer();
    /// @notice There is nothing to refund or withdraw.
    error NothingToRefund();
    /// @notice The balance holds extra funds that must be refunded before withdrawal.
    error ExtraFundsPending();
    /// @notice The amount is larger than the extra funds or the refundable amount.
    error AmountTooLarge();
    /// @notice The contract balance is less than the amount needed.
    error InsufficientBalance();
    /// @notice The order's closing conditions are not met yet.
    error NotClosable();
    /// @notice The collector's reuse delay has not passed yet.
    error ReuseDelayActive();
    /// @notice The balance must be zero before this action.
    error BalanceNotZero();
    /// @notice A refund request is already open on this order.
    error RefundAlreadyOpen();
    /// @notice There is no refund request in the required state.
    error NoRefundRequest();
    /// @notice The order was withdrawn, so its refund must be paid through the spender.
    error WithdrawnRefundNeedsSpender();
    /// @notice The order has not been withdrawn, so its refund must be paid from this contract.
    error NotWithdrawn();

    /// @notice The USDT token of the order.
    address public immutable usdt;

    /// @notice The merchant who owns this collector and receives withdrawals.
    address public immutable merchant;

    /// @notice The relayer that operates this collector. It can act within the merchant's mandate.
    address public immutable relayer;

    /// @notice The book that deployed this collector and holds the mandate.
    address public immutable book;

    /// @notice The spender that moves funds for payments and withdrawn-order refunds.
    address public immutable spender;

    /// @dev State of the current assignment.
    State internal s;

    /// @dev Restricts a function to the merchant.
    modifier onlyMerchant() {
        if (msg.sender != merchant) revert NotMerchant();
        _;
    }

    /// @dev Restricts a function to the spender.
    modifier onlySpender() {
        if (msg.sender != spender) revert NotSpender();
        _;
    }

    /// @dev Restricts a function to the book.
    modifier onlyBook() {
        if (msg.sender != book) revert NotBook();
        _;
    }

    /// @dev Restricts a function to orders that are paid, partially refunded, or refunded.
    modifier onlyPaidOrder() {
        if (!_isPaidStatus(s.status)) revert NotPaid();
        _;
    }

    /// @notice Deploys the collector for its first order. Called by the factory on behalf of the book.
    /// @param usdt_ The USDT token address.
    /// @param merchant_ The merchant address.
    /// @param relayer_ The relayer that operates this collector.
    /// @param book_ The book that deploys this collector.
    /// @param spender_ The spender that moves funds for payments and withdrawn-order refunds.
    /// @param orderId_ The order id.
    /// @param amount_ The exact amount due.
    /// @param refundWindow_ The refund window in seconds.
    constructor(
        address usdt_,
        address merchant_,
        address relayer_,
        address book_,
        address spender_,
        bytes32 orderId_,
        uint256 amount_,
        uint256 refundWindow_
    ) {
        if (
            usdt_ == address(0) || merchant_ == address(0) || relayer_ == address(0) || book_ == address(0)
                || spender_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (orderId_ == bytes32(0)) revert ZeroOrderId();
        if (amount_ == 0) revert ZeroAmount();
        _checkRefundWindow(refundWindow_);

        usdt = usdt_;
        merchant = merchant_;
        relayer = relayer_;
        book = book_;
        spender = spender_;

        _startAssignment(orderId_, amount_, 0, refundWindow_);
    }

    /// @notice The collector's current assignment number.
    /// @return The epoch.
    function epoch() external view returns (uint256) {
        return s.epoch;
    }

    /// @inheritdoc IOrderCollector
    function payInfo() external view returns (bool open, uint256 amount) {
        open = s.status == OrderStatus.Open && block.timestamp <= s.expiresAt;
        return (open, s.amount);
    }

    /// @inheritdoc IOrderCollector
    function recordPayment(address payer) external onlySpender {
        if (s.status != OrderStatus.Open) revert NotOpen();
        if (block.timestamp > s.expiresAt) revert OrderExpired();
        if (payer == address(0)) revert ZeroAddress();

        _recordPaid(payer, bytes32(0), uint64(block.timestamp));

        emit PaymentReceived(s.orderId, payer, s.amount, bytes32(0));
    }

    /// @notice Confirms a plain-transfer payment. Callable by the merchant directly, or by the relayer within the mandate.
    ///         The transfer must have happened inside the payment window, and the balance must hold the amount.
    /// @param payer The address that sent the USDT.
    /// @param transferTime Block time of the transfer, which must be inside the payment window.
    /// @param txHash Hash of the transfer transaction.
    function markPaid(address payer, uint256 transferTime, bytes32 txHash) external {
        if (s.status != OrderStatus.Open) revert NotOpen();
        if (payer == address(0)) revert ZeroAddress();
        if (transferTime > s.expiresAt) revert OrderExpired();

        _authorize(0);

        if (IERC20(usdt).balanceOf(address(this)) < s.amount) revert InsufficientBalance();

        _recordPaid(payer, txHash, uint64(transferTime));

        emit PaymentReceived(s.orderId, payer, s.amount, txHash);
    }

    /// @notice Marks an open order as failed once its payment window has passed. Callable by anyone.
    function expire() external {
        if (s.status != OrderStatus.Open) revert NotOpen();
        if (block.timestamp <= s.expiresAt) revert NotExpired();

        s.status = OrderStatus.Failed;

        emit OrderFailed(s.orderId);
    }

    /// @notice Marks an open or paid order as failed, so it will not complete. Only before withdrawal.
    ///         The merchant can do this directly, or the relayer within the mandate.
    function failOrder() external {
        if (s.status != OrderStatus.Open && s.status != OrderStatus.Paid) revert InvalidStatus();
        if (s.withdrawn) revert InvalidStatus();

        _authorize(0);

        s.status = OrderStatus.Failed;

        emit OrderFailed(s.orderId);
    }

    /// @notice Refunds the whole balance of a failed order to its recorded payer. Callable by anyone, since the
    ///         destination is fixed to the payer.
    function refundFailedOrder() external {
        if (s.status != OrderStatus.Failed) revert InvalidStatus();
        address payer = s.payer;
        if (payer == address(0)) revert NoPayer();

        uint256 balance = IERC20(usdt).balanceOf(address(this));
        if (balance == 0) revert NothingToRefund();

        IERC20(usdt).safeTransfer(payer, balance);

        emit FailedOrderRefunded(s.orderId, payer, balance);
    }

    /// @notice Refunds funds to an address directly.
    /// @dev On an unpaid order (open, failed, or closed), any amount in the balance can be refunded, which covers stray
    ///      or late transfers. On a paid, partially refunded, or refunded order, only the extra above what is still owed
    ///      can be refunded. The amount counts against the mandate's value limit when the relayer does it.
    /// @param to The address receiving the refund.
    /// @param refundAmount The amount to send back.
    function refundTo(address to, uint256 refundAmount) external {
        if (to == address(0)) revert ZeroAddress();
        if (refundAmount == 0) revert ZeroAmount();

        if (_isPaidStatus(s.status)) {
            if (refundAmount > _extra()) revert AmountTooLarge();
        } else if (s.status == OrderStatus.Open || s.status == OrderStatus.Failed || s.status == OrderStatus.Closed) {
            if (IERC20(usdt).balanceOf(address(this)) < refundAmount) revert InsufficientBalance();
        } else {
            revert InvalidStatus();
        }

        _authorize(refundAmount);

        IERC20(usdt).safeTransfer(to, refundAmount);

        emit FundsRefunded(s.orderId, to, refundAmount);
    }

    /// @notice Sends the balance to the merchant. Callable by anyone, but only once the order is paid, and only when
    ///         the balance holds no extra beyond what is still owed. Partial withdrawal is allowed.
    function withdraw() external {
        if (s.status != OrderStatus.Paid && s.status != OrderStatus.PartiallyRefunded) revert InvalidStatus();
        if (s.withdrawn) revert InvalidStatus();

        uint256 balance = IERC20(usdt).balanceOf(address(this));
        if (balance == 0) revert NothingToRefund();
        if (_extra() != 0) revert ExtraFundsPending();

        s.withdrawn = true;
        if (s.settledAt == 0) s.settledAt = uint64(block.timestamp);
        IERC20(usdt).safeTransfer(merchant, balance);

        emit Withdrawn(s.orderId, balance);
    }

    /// @notice Sets the refund window in days, until the order is withdrawn. Callable by the merchant directly, or by
    ///         the relayer within the mandate. Allowed range is 1 to 365 days.
    /// @param refundDays The new window in days.
    function setRefundWindow(uint256 refundDays) external {
        if (s.withdrawn || s.status == OrderStatus.Closed || s.status == OrderStatus.Failed) revert InvalidStatus();
        if (refundDays < MIN_REFUND_WINDOW / 1 days || refundDays > MAX_REFUND_WINDOW / 1 days) {
            revert InvalidRefundWindow();
        }
        uint256 window = refundDays * 1 days;

        _authorize(0);

        s.refundWindow = uint64(window);

        emit RefundWindowSet(s.orderId, uint64(window));
    }

    /// @notice Closes the assignment so it can be archived and reused.
    /// @dev A paid, partially refunded, or refunded order closes once it has been settled (withdrawn, or fully refunded),
    ///      its refund window has passed, no refund is open, and its balance is zero. A failed order closes once its
    ///      balance is zero.
    function close() external {
        if (s.status == OrderStatus.Failed) {
            if (IERC20(usdt).balanceOf(address(this)) != 0) revert NotClosable();
        } else if (_isPaidStatus(s.status)) {
            if (s.settledAt == 0 || block.timestamp < s.settledAt + s.refundWindow) revert NotClosable();
            if (s.refundStatus == RefundStatus.Requested || s.refundStatus == RefundStatus.Approved) {
                revert NotClosable();
            }
            if (IERC20(usdt).balanceOf(address(this)) != 0) revert NotClosable();
        } else {
            revert NotClosable();
        }

        s.status = OrderStatus.Closed;
        s.closedAt = uint64(block.timestamp);

        emit OrderClosed(s.orderId, s.closedAt);
    }

    /// @notice Gives the closed collector a new order. Callable only by the book, which archives the previous
    ///         assignment in the same transaction.
    /// @param newOrderId The new order id.
    /// @param newAmount The new amount due.
    /// @param newRefundWindow The new refund window in seconds.
    function reset(bytes32 newOrderId, uint256 newAmount, uint256 newRefundWindow) external onlyBook {
        if (s.status != OrderStatus.Closed) revert InvalidStatus();
        if (block.timestamp < s.closedAt + REUSE_DELAY) revert ReuseDelayActive();
        if (IERC20(usdt).balanceOf(address(this)) != 0) revert BalanceNotZero();
        if (newOrderId == bytes32(0)) revert ZeroOrderId();
        if (newAmount == 0) revert ZeroAmount();
        _checkRefundWindow(newRefundWindow);

        uint256 nextEpoch = s.epoch + 1;
        _startAssignment(newOrderId, newAmount, nextEpoch, newRefundWindow);

        emit OrderReset(newOrderId, nextEpoch, newAmount, s.expiresAt);
    }

    /// @notice Opens a refund request. Callable by the payer on a paid or partially refunded order.
    ///         The requested amount is recorded for reference only. The merchant chooses the amount that is refunded.
    /// @param reasonHash Hash of the off-chain reason text.
    /// @param requestedAmount The amount the customer is asking for. Recorded only.
    function requestRefund(bytes32 reasonHash, uint256 requestedAmount) external onlyPaidOrder {
        if (msg.sender != s.payer) revert NotPayer();
        if (s.refundStatus != RefundStatus.None && s.refundStatus != RefundStatus.Denied) {
            revert RefundAlreadyOpen();
        }
        if (requestedAmount == 0) revert ZeroAmount();
        if (_refundable() == 0) revert NothingToRefund();

        s.refundStatus = RefundStatus.Requested;
        s.refundRequestedAmount = requestedAmount;
        s.refundReasonHash = reasonHash;

        emit RefundRequested(s.orderId, msg.sender, requestedAmount, reasonHash);
    }

    /// @notice Approves a refund amount for the open request. Callable by the merchant directly, or by the relayer
    ///         within the mandate. The amount can be any part of what is still refundable. Does not move funds.
    /// @param amount The amount to refund.
    function approveRefund(uint256 amount) external onlyPaidOrder {
        if (s.refundStatus != RefundStatus.Requested) revert NoRefundRequest();
        if (amount == 0) revert ZeroAmount();
        if (amount > _refundable()) revert AmountTooLarge();

        _authorize(amount);

        s.refundStatus = RefundStatus.Approved;
        s.refundApprovedAmount = amount;

        emit RefundApproved(s.orderId, amount);
    }

    /// @notice Starts a refund without a customer request, approving `amount` at once. Pay it next with `executeRefund`
    ///         (before withdrawal) or through the spender (after withdrawal). Callable by the merchant directly, or by the
    ///         relayer within the mandate. Does not move funds. Not allowed while a customer request is open.
    /// @param amount The amount to refund, up to what is still refundable.
    /// @param noteHash Hash of the merchant's off-chain reason.
    function initiateRefund(uint256 amount, bytes32 noteHash) external onlyPaidOrder {
        if (s.refundStatus == RefundStatus.Requested || s.refundStatus == RefundStatus.Approved) {
            revert RefundAlreadyOpen();
        }
        if (amount == 0) revert ZeroAmount();
        if (amount > _refundable()) revert AmountTooLarge();

        _authorize(amount);

        s.refundStatus = RefundStatus.Approved;
        s.refundApprovedAmount = amount;
        s.refundReasonHash = noteHash;

        emit RefundInitiated(s.orderId, amount, noteHash);
    }

    /// @notice Denies the open refund request. Callable by the merchant directly, or by the relayer within the mandate.
    ///         The payer may request again.
    /// @param noteHash Hash of the merchant's off-chain note.
    function denyRefund(bytes32 noteHash) external onlyPaidOrder {
        if (s.refundStatus != RefundStatus.Requested) revert NoRefundRequest();

        _authorize(0);

        s.refundStatus = RefundStatus.Denied;

        emit RefundDenied(s.orderId, noteHash);
    }

    /// @notice Pays the approved refund from this contract's balance, for an order that has not been withdrawn.
    ///         Callable by the merchant directly, or by the relayer within the mandate.
    function executeRefund() external onlyPaidOrder {
        if (s.withdrawn) revert WithdrawnRefundNeedsSpender();
        if (s.refundStatus != RefundStatus.Approved) revert NoRefundRequest();

        uint256 refundAmount = s.refundApprovedAmount;
        if (refundAmount > _owed()) revert AmountTooLarge();

        _authorize(0);

        address payer = s.payer;
        _applyRefund(refundAmount);

        IERC20(usdt).safeTransfer(payer, refundAmount);

        emit RefundExecuted(s.orderId, payer, refundAmount, false);
    }

    /// @notice Records an approved refund on a withdrawn order after the spender has moved the tokens. Callable only by
    ///         the spender, in the same transaction, so the record can't get ahead of the money.
    function settleWithdrawnRefund() external onlySpender {
        if (!s.withdrawn) revert NotWithdrawn();
        if (!_isPaidStatus(s.status)) revert NotPaid();
        if (s.refundStatus != RefundStatus.Approved) revert NoRefundRequest();

        uint256 refundAmount = s.refundApprovedAmount;
        address payer = s.payer;
        _applyRefund(refundAmount);

        emit RefundExecuted(s.orderId, payer, refundAmount, true);
    }

    /// @notice Records a refund the merchant has already sent from their own wallet. Callable only by the merchant,
    ///         and only after the order is withdrawn.
    /// @param refundAmount Amount the merchant sent to the payer.
    function recordRefund(uint256 refundAmount) external onlyMerchant onlyPaidOrder {
        if (!s.withdrawn) revert NotWithdrawn();
        if (s.refundStatus == RefundStatus.Requested || s.refundStatus == RefundStatus.Approved) {
            revert RefundAlreadyOpen();
        }
        if (refundAmount == 0) revert ZeroAmount();
        if (refundAmount > _refundable()) revert AmountTooLarge();

        _applyRefund(refundAmount);

        emit RefundRecorded(s.orderId, refundAmount);
    }

    /// @inheritdoc IOrderCollector
    function pullInfo() external view returns (bool withdrawn, uint8 status, address payer, uint256 approvedAmount) {
        return (s.withdrawn, uint8(s.refundStatus), s.payer, s.refundApprovedAmount);
    }

    /// @notice Returns the full state of the current assignment.
    /// @return The state.
    function getState() external view returns (State memory) {
        return s;
    }

    /// @dev Lets the merchant act directly. Otherwise the caller must be the relayer, and the book's mandate must allow
    ///      one more action, and `amount` more value.
    function _authorize(uint256 amount) private {
        if (msg.sender == merchant) return;
        if (msg.sender != relayer) revert NotAuthorized();
        IMerchantOrders(book).consumeMandate(msg.sender, 0, 1, amount);
    }

    /// @dev Starts a new assignment with a fresh payment window.
    function _startAssignment(bytes32 orderId_, uint256 amount_, uint256 epoch_, uint256 refundWindow_) private {
        delete s;
        s.orderId = orderId_;
        s.amount = amount_;
        s.epoch = epoch_;
        s.expiresAt = uint64(block.timestamp + ORDER_TTL);
        s.refundWindow = uint64(refundWindow_);
        s.status = OrderStatus.Open;
    }

    /// @dev Records a confirmed payment and moves the order to Paid.
    function _recordPaid(address payer, bytes32 txHash, uint64 paidAt) private {
        s.status = OrderStatus.Paid;
        s.payer = payer;
        s.paidAt = paidAt;
        s.paymentTxHash = txHash;
    }

    /// @dev Applies a refund amount to the record, clears the request, and updates the status.
    function _applyRefund(uint256 refundAmount) private {
        s.refundedAmount += refundAmount;
        s.refundStatus = RefundStatus.None;
        s.refundRequestedAmount = 0;
        s.refundApprovedAmount = 0;

        if (s.refundedAmount == s.amount) {
            s.status = OrderStatus.Refunded;
            if (s.settledAt == 0) s.settledAt = uint64(block.timestamp);
        } else {
            s.status = OrderStatus.PartiallyRefunded;
        }
    }

    /// @dev Amount that can still be refunded in total.
    function _refundable() private view returns (uint256) {
        return s.amount - s.refundedAmount;
    }

    /// @dev Amount still owed from this contract's balance. Zero once withdrawn, since later refunds come from the
    ///      merchant's wallet.
    function _owed() private view returns (uint256) {
        return s.withdrawn ? 0 : _refundable();
    }

    /// @dev Balance above what is still owed. Extra funds, which can be refunded on paid orders.
    function _extra() private view returns (uint256) {
        uint256 balance = IERC20(usdt).balanceOf(address(this));
        uint256 owed = _owed();
        return balance > owed ? balance - owed : 0;
    }

    /// @dev Whether a status is one of the paid statuses.
    function _isPaidStatus(OrderStatus status) private pure returns (bool) {
        return status == OrderStatus.Paid || status == OrderStatus.PartiallyRefunded || status == OrderStatus.Refunded;
    }

    /// @dev Checks that a refund window in seconds is within the allowed range.
    function _checkRefundWindow(uint256 window) private pure {
        if (window < MIN_REFUND_WINDOW || window > MAX_REFUND_WINDOW) revert InvalidRefundWindow();
    }
}
