// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IOrderCollectorActions
/// @notice The order collector calls that smart accounts make, as customer (payer) or as merchant.
interface IOrderCollectorActions {
    /// @notice Whether an order is open for payment, and the amount due.
    function payInfo() external view returns (bool open, uint256 amount);

    /// @notice The refund details needed to pay an approved refund from the merchant's wallet.
    function pullInfo() external view returns (bool withdrawn, uint8 status, address payer, uint256 approvedAmount);

    /// @notice Customer asks for a refund on an order it paid.
    function requestRefund(bytes32 reasonHash, uint256 requestedAmount) external;

    /// @notice Merchant confirms a plain USDT transfer as the payment.
    function markPaid(address payer, uint256 transferTime, bytes32 txHash) external;

    /// @notice Merchant marks an open order as failed, before withdrawal.
    function failOrder() external;

    /// @notice Merchant changes the refund window, until withdrawal.
    function setRefundWindow(uint256 refundDays) external;

    /// @notice Merchant approves a refund amount on an open customer request.
    function approveRefund(uint256 amount) external;

    /// @notice Merchant starts a refund without a customer request. Pay it next with `executeRefund` or the spender.
    function initiateRefund(uint256 amount, bytes32 noteHash) external;

    /// @notice Merchant denies an open customer request.
    function denyRefund(bytes32 noteHash) external;

    /// @notice Merchant pays an approved refund from the order's balance, before withdrawal.
    function executeRefund() external;

    /// @notice Merchant sends extra or stray funds in the order's balance to an address.
    function refundTo(address to, uint256 amount) external;

    /// @notice Merchant records a refund it sent from its own wallet, after withdrawal.
    function recordRefund(uint256 amount) external;
}
