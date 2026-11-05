// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IMerchantRegistry
/// @notice Read interface of the merchant registry, used by other contracts to confirm a merchant's book.
interface IMerchantRegistry {
    /// @notice Returns the order book of a merchant.
    /// @param merchant The merchant address.
    /// @return The book address, or zero if the address has not registered.
    function bookOf(address merchant) external view returns (address);
}
