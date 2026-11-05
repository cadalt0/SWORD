// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title ICollectorFactory
/// @notice Creates order collectors. Kept separate so the registry and books do not carry the collector's code.
interface ICollectorFactory {
    /// @notice Deploys a collector for one order.
    /// @param usdt The USDT token address.
    /// @param merchant The merchant that owns the order.
    /// @param relayer The relayer that operates the order.
    /// @param book The book that assigns the order.
    /// @param spender The spender that moves funds for payments and withdrawn-order refunds.
    /// @param orderId The order id.
    /// @param amount The exact amount due.
    /// @param refundWindow The refund window in seconds.
    /// @return collector The address of the new collector.
    function createCollector(
        address usdt,
        address merchant,
        address relayer,
        address book,
        address spender,
        bytes32 orderId,
        uint256 amount,
        uint256 refundWindow
    ) external returns (address collector);
}
