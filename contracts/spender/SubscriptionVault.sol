// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SubscriptionVault
/// @notice The deposit address of one subscription. Each period's payment is pulled into it, and it holds the money
///         until the merchant withdraws it or a refund is paid from it.
/// @dev The spender deploys one implementation and clones it once per subscription. The spender address is an
///      immutable of the implementation, so every clone obeys only that spender. Holds no other state.
contract SubscriptionVault {
    using SafeERC20 for IERC20;

    /// @notice The spender that controls every vault cloned from this implementation.
    address public immutable spender;

    /// @notice The caller is not the spender.
    error NotSpender();

    constructor() {
        spender = msg.sender;
    }

    /// @notice Sends tokens held by this vault. Callable only by the spender.
    /// @param token The token to send.
    /// @param to The recipient.
    /// @param amount The amount to send.
    function pay(address token, address to, uint256 amount) external {
        if (msg.sender != spender) revert NotSpender();
        IERC20(token).safeTransfer(to, amount);
    }
}
