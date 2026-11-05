// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {IAccount} from "../../interfaces/IAccount.sol";

/// @title AccountFactory
/// @notice Creates customer and merchant smart accounts from two blueprints, one for each kind. Each account is a
///         lightweight copy of its blueprint, created at an address that depends only on the blueprint and the
///         identity. One identity has at most one customer account and one merchant account.
/// @dev Only the relayer that deployed the factory can create accounts. Anyone can predict an address. The blueprints
///      are deployed first and their addresses are given to this factory. No admin, upgrade, or pause paths.
contract AccountFactory {
    /// @notice The relayer that deployed the factory. The only address that may create accounts.
    address public immutable relayer;

    /// @notice Blueprint of customer accounts.
    address public immutable customerBlueprint;

    /// @notice Blueprint of merchant accounts.
    address public immutable merchantBlueprint;

    /// @notice The USDT token every account holds.
    address public immutable usdt;

    /// @notice The shared spender every account uses.
    address public immutable spender;

    /// @notice The merchant registry merchant accounts register with.
    address public immutable registry;

    /// @notice The customer account created for each identifier hash, or zero if none.
    mapping(bytes32 identifierHash => address account) public customerAccountOf;

    /// @notice The merchant account created for each identifier hash, or zero if none.
    mapping(bytes32 identifierHash => address account) public merchantAccountOf;

    /// @notice Emitted when an account is created.
    /// @param isMerchant True for a merchant account, false for a customer account.
    event AccountCreated(bytes32 indexed identifierHash, address indexed owner, address indexed account, bool isMerchant);

    error ZeroAddress();
    error ZeroIdentifier();
    error NotRelayer();
    error AccountExists();

    /// @dev Restricts a function to the relayer that deployed the factory.
    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    /// @param customerBlueprint_ Address of the deployed customer account blueprint.
    /// @param merchantBlueprint_ Address of the deployed merchant account blueprint.
    /// @param usdt_ The USDT token address.
    /// @param spender_ The shared spender address.
    /// @param registry_ The merchant registry address.
    constructor(
        address customerBlueprint_,
        address merchantBlueprint_,
        address usdt_,
        address spender_,
        address registry_
    ) {
        if (
            customerBlueprint_ == address(0) || merchantBlueprint_ == address(0) || usdt_ == address(0)
                || spender_ == address(0) || registry_ == address(0)
        ) {
            revert ZeroAddress();
        }
        relayer = msg.sender;
        customerBlueprint = customerBlueprint_;
        merchantBlueprint = merchantBlueprint_;
        usdt = usdt_;
        spender = spender_;
        registry = registry_;
    }

    /// @notice Creates the customer account for an identity. Relayer only. One account per identity.
    /// @param identifierHash Stable hash of the customer's login identity.
    /// @param owner_ The account owner: the customer's key, or the relayer's key for custodial accounts.
    /// @return account The new account address.
    function createCustomerAccount(bytes32 identifierHash, address owner_)
        external
        onlyRelayer
        returns (address account)
    {
        account = _create(customerBlueprint, identifierHash, owner_, false);
        customerAccountOf[identifierHash] = account;
    }

    /// @notice Creates the merchant account for an identity. Relayer only. One account per identity.
    /// @param identifierHash Stable hash of the merchant's login identity.
    /// @param owner_ The account owner: the merchant's key, or the relayer's key for custodial accounts.
    /// @return account The new account address.
    function createMerchantAccount(bytes32 identifierHash, address owner_)
        external
        onlyRelayer
        returns (address account)
    {
        account = _create(merchantBlueprint, identifierHash, owner_, true);
        merchantAccountOf[identifierHash] = account;
    }

    /// @notice The address a customer account will have. Known before the account exists.
    /// @param identifierHash Stable hash of the customer's login identity.
    function predictCustomerAccount(bytes32 identifierHash) external view returns (address) {
        return Clones.predictDeterministicAddress(customerBlueprint, _salt(identifierHash, false), address(this));
    }

    /// @notice The address a merchant account will have. Known before the account exists.
    /// @param identifierHash Stable hash of the merchant's login identity.
    function predictMerchantAccount(bytes32 identifierHash) external view returns (address) {
        return Clones.predictDeterministicAddress(merchantBlueprint, _salt(identifierHash, true), address(this));
    }

    /// @dev Creates an account from a blueprint and sets it up in the same transaction.
    function _create(address blueprint, bytes32 identifierHash, address owner_, bool isMerchant)
        private
        returns (address account)
    {
        if (identifierHash == bytes32(0)) revert ZeroIdentifier();
        if (owner_ == address(0)) revert ZeroAddress();

        bool exists = isMerchant ? merchantAccountOf[identifierHash] != address(0)
            : customerAccountOf[identifierHash] != address(0);
        if (exists) revert AccountExists();

        account = Clones.cloneDeterministic(blueprint, _salt(identifierHash, isMerchant));
        IAccount(account).initialize(owner_, relayer, usdt, spender, registry);

        emit AccountCreated(identifierHash, owner_, account, isMerchant);
    }

    /// @dev Customer and merchant accounts for one identity get different addresses.
    function _salt(bytes32 identifierHash, bool isMerchant) private pure returns (bytes32) {
        return keccak256(abi.encode(isMerchant, identifierHash));
    }
}
