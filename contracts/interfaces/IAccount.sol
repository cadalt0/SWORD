// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IAccount
/// @notice Setup call that the account factory makes once, right after it creates an account.
interface IAccount {
    /// @notice Sets the account's owner, relayer, and the contracts it uses. Callable once.
    /// @param owner_ The owner: the customer or merchant key, or the relayer key for custodial accounts.
    /// @param relayer_ The relayer that may act under a grant.
    /// @param usdt_ The USDT token address.
    /// @param spender_ The shared spender address.
    /// @param registry_ The merchant registry address.
    function initialize(address owner_, address relayer_, address usdt_, address spender_, address registry_) external;
}
