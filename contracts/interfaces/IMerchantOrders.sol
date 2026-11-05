// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IMerchantOrders
/// @notice Interface for one merchant's order book. The book holds the merchant's monthly mandate for its relayer,
///         creates orders, assigns each order a collector, and archives an order's details before its collector is reused.
/// @dev The book holds no funds and moves no tokens. Relayer actions are checked against the mandate's limits.
interface IMerchantOrders {
    /// @notice A standing authorization from the merchant to one relayer, signed once.
    /// @param relayer The only address allowed to use this mandate.
    /// @param expiry Time after which the mandate no longer works.
    /// @param maxOrders Maximum number of orders the relayer may create.
    /// @param maxActions Maximum number of relayer actions (payment confirmations, approvals, denials, and so on).
    /// @param maxAmount Maximum total value the relayer may approve or refund.
    /// @param nonce The book's nonce when the mandate was signed. Revoking changes the nonce, invalidating it.
    struct Mandate {
        address relayer;
        uint256 expiry;
        uint256 maxOrders;
        uint256 maxActions;
        uint256 maxAmount;
        uint256 nonce;
    }

    /// @notice How much of the current mandate has been used.
    /// @param orders Orders created.
    /// @param actions Relayer actions taken.
    /// @param amount Value approved or refunded.
    struct MandateUsage {
        uint256 orders;
        uint256 actions;
        uint256 amount;
    }

    /// @notice Current record of an order id.
    /// @param amount Amount due for the order, in USDT base units.
    /// @param collector The collector serving this order id.
    /// @param exists True once the order id has been used.
    /// @param active False once the order id has been replaced by a newer order on the same collector.
    struct OrderRecord {
        uint256 amount;
        address collector;
        bool exists;
        bool active;
    }

    /// @notice Full archived details of one assignment of a collector.
    /// @param orderId The order id of this assignment.
    /// @param epoch The assignment number of the collector.
    /// @param amount The amount due for this assignment.
    /// @param refundWindow The refund window in seconds.
    /// @param payer The customer who paid, or zero if never paid.
    /// @param paidAt Time the payment was recorded.
    /// @param paymentTxHash Hash of the transfer, if the payment was confirmed from a plain transfer.
    /// @param withdrawn True if the balance was withdrawn to the merchant.
    /// @param settledAt Time the order was settled: withdrawal, or full refund.
    /// @param refundedAmount Total refunded in this assignment.
    /// @param refundStatus Refund status at the time of closing.
    /// @param refundReasonHash Hash of the last refund reason.
    /// @param closedAt Time the assignment was closed.
    struct ArchivedOrder {
        bytes32 orderId;
        uint256 epoch;
        uint256 amount;
        uint64 refundWindow;
        address payer;
        uint64 paidAt;
        bytes32 paymentTxHash;
        bool withdrawn;
        uint64 settledAt;
        uint256 refundedAmount;
        uint8 refundStatus;
        bytes32 refundReasonHash;
        uint64 closedAt;
    }

    /// @notice Emitted when an order and its collector are created.
    /// @param orderId Merchant-chosen order identifier.
    /// @param collector The collector serving the order.
    /// @param amount Amount due for the order.
    event OrderCreated(bytes32 indexed orderId, address indexed collector, uint256 amount);

    /// @notice Emitted when a closed collector is archived before being reused.
    /// @param collector The collector being reused.
    /// @param epoch The assignment being archived.
    /// @param orderId The order id of the archived assignment.
    event OrderArchived(address indexed collector, uint256 epoch, bytes32 orderId);

    /// @notice Emitted when a closed collector is given a new order.
    /// @param collector The reused collector.
    /// @param previousOrderId The order id that was archived.
    /// @param orderId The new order id.
    /// @param epoch The new assignment number.
    event CollectorReassigned(
        address indexed collector, bytes32 previousOrderId, bytes32 indexed orderId, uint256 epoch
    );

    /// @notice Emitted when the merchant sets a new mandate.
    /// @param relayer The relayer the mandate names.
    /// @param expiry Expiry of the mandate.
    /// @param maxOrders Order limit.
    /// @param maxActions Action limit.
    /// @param maxAmount Amount limit.
    event MandateSet(address indexed relayer, uint256 expiry, uint256 maxOrders, uint256 maxActions, uint256 maxAmount);

    /// @notice Emitted when the merchant revokes the mandate and all permissions.
    /// @param newNonce The nonce that any new mandate must be signed with.
    event MandateRevoked(uint256 newNonce);

    /// @notice A constructor argument was the zero address.
    error ZeroAddress();
    /// @notice An amount argument was zero.
    error ZeroAmount();
    /// @notice An order with this id already exists.
    error OrderExists();
    /// @notice The caller is not the merchant.
    error NotMerchant();
    /// @notice The caller is neither the merchant nor the relayer named in the mandate.
    error NotAuthorized();
    /// @notice The address is not a collector deployed by this book, or the spender.
    error NotCollector();
    /// @notice The mandate signature was not made by the merchant.
    error InvalidSigner();
    /// @notice The mandate was signed for an older nonce, so it has been revoked.
    error InvalidNonce();
    /// @notice No mandate is in place.
    error MandateNotSet();
    /// @notice The mandate has expired.
    error MandateExpired();
    /// @notice The mandate's expiry is too far in the future.
    error MandateTooLong();
    /// @notice The mandate asks for more than the hard limits allow.
    error MandateCapTooHigh();
    /// @notice The action would exceed the mandate's limit.
    error MandateLimitExceeded();

    /// @notice Sets the merchant's mandate for its relayer. Replaces any previous mandate and resets its usage.
    /// @dev The mandate must be signed by the merchant. Anyone may submit it.
    /// @param mandate The mandate terms.
    /// @param signature The merchant's signature over the mandate.
    function setMandate(Mandate calldata mandate, bytes calldata signature) external;

    /// @notice Creates an order and deploys a new collector for it.
    /// @dev The merchant can call this directly. The relayer can call it within the mandate's order limit.
    /// @param orderId Unique order identifier.
    /// @param amount Amount due, in USDT base units. Must be non-zero.
    /// @param refundDays Refund window in days. Zero means the default of 7 days.
    /// @param relayer The relayer that will operate this order. Must be non-zero, and equal to the caller when the relayer calls.
    /// @return collector Address of the newly deployed collector for this order.
    function createOrder(bytes32 orderId, uint256 amount, uint256 refundDays, address relayer)
        external
        returns (address collector);

    /// @notice Gives a closed collector a new order, after archiving its previous assignment.
    /// @param collector The closed collector to reuse.
    /// @param orderId The new order id. Must not have been used before.
    /// @param amount The new amount due, in USDT base units. Must be non-zero.
    /// @param refundDays The new refund window in days. Zero means the default of 7 days.
    function reuseCollector(address collector, bytes32 orderId, uint256 amount, uint256 refundDays) external;

    /// @notice Records a relayer action against the mandate. Callable only by this book's collectors and the spender.
    /// @param caller The relayer that performed the action.
    /// @param orders Orders to count.
    /// @param actions Actions to count.
    /// @param amount Value to count.
    function consumeMandate(address caller, uint256 orders, uint256 actions, uint256 amount) external;

    /// @notice Invalidates the current mandate and every outstanding signature, by advancing the nonce.
    function revoke() external;

    /// @notice Returns the current record of an order id (all-zero if never used).
    /// @param orderId The order to read.
    /// @return The order record.
    function getOrder(bytes32 orderId) external view returns (OrderRecord memory);

    /// @notice Returns the current mandate and how much of it has been used.
    /// @return mandate The mandate.
    /// @return usage The usage so far.
    function getMandate() external view returns (Mandate memory mandate, MandateUsage memory usage);

    /// @notice Returns the archived details of one assignment of a collector.
    /// @param collector The collector.
    /// @param epoch The assignment number.
    /// @return The archived record.
    function getArchive(address collector, uint256 epoch) external view returns (ArchivedOrder memory);

    /// @notice Whether an address is a collector deployed by this book.
    /// @param collector The address to check.
    /// @return True if the book deployed it.
    function isCollector(address collector) external view returns (bool);

    /// @notice The USDT token used for settlement.
    /// @return The token address.
    function usdt() external view returns (address);

    /// @notice The merchant that owns this book.
    /// @return The merchant address.
    function merchant() external view returns (address);

    /// @notice The spender that collectors of this book are wired to.
    /// @return The spender address.
    function spender() external view returns (address);

    /// @notice The factory that deploys this book's collectors.
    /// @return The factory address.
    function factory() external view returns (address);

    /// @notice Current nonce. Advances on revoke.
    /// @return The nonce.
    function nonce() external view returns (uint256);
}
