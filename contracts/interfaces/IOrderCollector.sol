// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IOrderCollector
/// @notice The parts of an order collector that other contracts in the system use.
interface IOrderCollector {
    /// @notice The merchant that owns the order.
    /// @return The merchant address.
    function merchant() external view returns (address);

    /// @notice The relayer that operates the order.
    /// @return The relayer address.
    function relayer() external view returns (address);

    /// @notice The book that deployed the collector.
    /// @return The book address.
    function book() external view returns (address);

    /// @notice The spender that moves funds for payments and withdrawn-order refunds.
    /// @return The spender address.
    function spender() external view returns (address);

    /// @notice The collector's current assignment number. It changes each time the collector is reused.
    /// @return The epoch.
    function epoch() external view returns (uint256);

    /// @notice Whether the order can currently accept a payment, and the amount due.
    /// @return open True if the order is open and inside its payment window.
    /// @return amount The exact amount due.
    function payInfo() external view returns (bool open, uint256 amount);

    /// @notice Records a payment that the spender has already moved into this contract. Callable only by the spender.
    /// @param payer The customer who paid.
    function recordPayment(address payer) external;

    /// @notice The refund details needed to pay an approved refund from the merchant's wallet.
    /// @return withdrawn True once the order's balance has been withdrawn.
    /// @return status The refund status: 0 None, 1 Requested, 2 Approved, 3 Denied.
    /// @return payer The customer who paid the order.
    /// @return approvedAmount The amount the merchant approved for the current refund.
    function pullInfo() external view returns (bool withdrawn, uint8 status, address payer, uint256 approvedAmount);

    /// @notice Records an approved refund on a withdrawn order after the spender has moved the tokens.
    ///         Callable only by the spender.
    function settleWithdrawnRefund() external;
}
