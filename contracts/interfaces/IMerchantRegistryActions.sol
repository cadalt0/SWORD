// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IMerchantRegistryActions
/// @notice The registration call that a merchant account makes to become a merchant.
interface IMerchantRegistryActions {
    /// @notice Registers the caller as a merchant and deploys its order book.
    /// @return book The address of the caller's new order book.
    function register() external returns (address book);
}
