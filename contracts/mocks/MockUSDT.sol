// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDT
/// @notice Test token with USDT's 6 decimals. Anyone can mint, so it is only for testnet use.
contract MockUSDT is ERC20 {
    /// @notice Deploys the token with the name "Mock USDT" and symbol "USDT".
    constructor() ERC20("Mock USDT", "USDT") {}

    /// @notice Returns the number of decimals, matching USDT.
    /// @return The decimals, which is 6.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mints tokens to any address. Callable by anyone.
    /// @param to The address receiving the tokens.
    /// @param amount The amount to mint, in base units.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
