// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ICollectorFactory} from "../interfaces/ICollectorFactory.sol";
import {OrderCollector} from "./OrderCollector.sol";

/// @title CollectorFactory
/// @notice Deploys order collectors on behalf of order books. Holds no funds and has no admin role.
/// @dev The collector's own checks are what matter: a collector only receives payments through the spender, and the
///      spender only accepts collectors whose book is the registered book of their merchant. So the factory itself
///      does not need to restrict who calls it.
contract CollectorFactory is ICollectorFactory {
    /// @inheritdoc ICollectorFactory
    function createCollector(
        address usdt,
        address merchant,
        address relayer,
        address book,
        address spender,
        bytes32 orderId,
        uint256 amount,
        uint256 refundWindow
    ) external returns (address collector) {
        collector = address(
            new OrderCollector(usdt, merchant, relayer, book, spender, orderId, amount, refundWindow)
        );
    }
}
