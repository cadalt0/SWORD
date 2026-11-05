// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IMerchantRegistry} from "../interfaces/IMerchantRegistry.sol";
import {MerchantOrders} from "./MerchantOrders.sol";

/// @title MerchantRegistry
/// @notice Open registry where any address can become a merchant. Registering deploys a dedicated
///         `MerchantOrders` book whose merchant is the caller.
/// @dev Holds no funds and has no admin role. Each address may register once and owns exactly one book.
contract MerchantRegistry is IMerchantRegistry {
    /// @notice Emitted when an address registers as a merchant.
    /// @param merchant The registering address, which owns the book.
    /// @param book The `MerchantOrders` contract deployed for the merchant.
    event MerchantRegistered(address indexed merchant, address indexed book);

    /// @notice A constructor argument was the zero address.
    error ZeroAddress();
    /// @notice The caller already has a book.
    error AlreadyRegistered();

    /// @notice The USDT token every book settles in.
    address public immutable usdt;

    /// @notice The spender every book's collectors are wired to.
    address public immutable spender;

    /// @notice The factory that deploys every book's collectors.
    address public immutable factory;

    /// @notice Number of registered merchants.
    uint256 public merchantCount;

    /// @inheritdoc IMerchantRegistry
    mapping(address merchant => address book) public bookOf;

    /// @notice Deploys the registry for a given settlement token and spender.
    /// @param usdt_ The USDT token address on this chain.
    /// @param spender_ The spender contract that pays refunds on withdrawn orders.
    /// @param factory_ The factory that deploys collectors.
    constructor(address usdt_, address spender_, address factory_) {
        if (usdt_ == address(0) || spender_ == address(0) || factory_ == address(0)) revert ZeroAddress();
        usdt = usdt_;
        spender = spender_;
        factory = factory_;
    }

    /// @notice Registers the caller as a merchant and deploys their order book.
    /// @return book The address of the caller's new `MerchantOrders` book.
    function register() external returns (address book) {
        if (bookOf[msg.sender] != address(0)) revert AlreadyRegistered();

        book = address(new MerchantOrders(usdt, msg.sender, spender, factory));
        bookOf[msg.sender] = book;
        ++merchantCount;

        emit MerchantRegistered(msg.sender, book);
    }
}
