// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAccount} from "../../interfaces/IAccount.sol";

/// @title AccountBase
/// @notice Shared logic of every smart account: the owner, the relayer's grant, freezing, sending USDT, and arbitrary
///         calls. Customer and merchant accounts inherit it and add their own actions.
/// @dev Accounts are created as copies of a blueprint, so state is set in `initialize`, not in a constructor. The
///      blueprint itself is locked when it is deployed. Each action by the relayer is checked against the grant, and
///      money actions count against the grant's amount. The owner acts without limits.
abstract contract AccountBase is IAccount, EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Longest a grant may run from signing, in seconds.
    uint256 public constant MAX_GRANT_DURATION = 31 days;

    /// @notice Highest total a grant may allow, in USDT base units.
    uint256 public constant MAX_GRANT_AMOUNT = 1_000_000_000;

    /// @dev EIP-712 type hash of a grant.
    bytes32 internal constant GRANT_TYPEHASH =
        keccak256("SmartAccountGrant(address relayer,uint256 expiry,uint256 maxAmount,uint256 nonce)");

    /// @notice A permission the owner signs for the relayer.
    /// @param relayer The only address allowed to act under this grant. Must be the account's relayer.
    /// @param expiry Time after which the grant no longer works.
    /// @param maxAmount Total USDT the relayer may move under this grant.
    /// @param nonce The account's nonce when signed. Revoking advances it, invalidating the grant.
    struct Grant {
        address relayer;
        uint256 expiry;
        uint256 maxAmount;
        uint256 nonce;
    }

    /// @dev Set once by `initialize`. The blueprint sets it in its constructor, so it can never be initialized.
    bool private _initialized;

    /// @notice The account's owner: the customer or merchant key, or the relayer key for custodial accounts.
    address public owner;

    /// @notice The relayer that may act under a grant.
    address public relayer;

    /// @notice The USDT token this account holds.
    address public usdt;

    /// @notice The shared spender that moves USDT for orders and subscriptions.
    address public spender;

    /// @notice The merchant registry. Used by merchant accounts to register.
    address public registry;

    /// @notice Whether the account is frozen. A frozen account takes no action until the owner unfreezes it.
    bool public frozen;

    /// @notice Hash of the reason given when the account was frozen. Zero when not frozen.
    bytes32 public freezeReason;

    /// @notice The account's nonce. Revoking a grant advances it.
    uint256 public nonce;

    /// @notice The current grant. The relayer address is zero when no grant is set.
    Grant public grant;

    /// @notice USDT the relayer has used under the current grant.
    uint256 public grantUsed;

    /// @notice Emitted when the account is set up.
    event AccountInitialized(address indexed owner, address indexed relayer);

    /// @notice Emitted when USDT is sent from the account.
    event UsdtSent(address indexed to, uint256 amount);

    /// @notice Emitted when the owner runs an arbitrary call.
    event Executed(address indexed target, uint256 value);

    /// @notice Emitted when the account is frozen.
    event Frozen(bytes32 reasonHash);

    /// @notice Emitted when the account is unfrozen.
    event Unfrozen();

    /// @notice Emitted when the owner sets a grant.
    event GrantSet(address indexed relayer, uint256 expiry, uint256 maxAmount, uint256 nonce);

    /// @notice Emitted when the owner revokes the grant. The nonce is the new value.
    event GrantRevoked(uint256 nonce);

    error AlreadyInitialized();
    error ZeroAddress();
    error ZeroAmount();
    error NotOwner();
    error NotAuthorized();
    error AccountFrozen();
    error GrantMissing();
    error GrantExpired();
    error GrantTooLong();
    error GrantCapTooHigh();
    error GrantLimitExceeded();
    error InvalidGrantRelayer();
    error InvalidNonce();
    error InvalidSigner();

    /// @dev Restricts a function to the owner.
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @dev Blocks a function while the account is frozen.
    modifier whenNotFrozen() {
        if (frozen) revert AccountFrozen();
        _;
    }

    /// @notice Locks the blueprint. Accounts made from it are not affected.
    constructor() EIP712("SmartAccount", "1") {
        _initialized = true;
    }

    /// @inheritdoc IAccount
    function initialize(address owner_, address relayer_, address usdt_, address spender_, address registry_)
        external
    {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        if (
            owner_ == address(0) || relayer_ == address(0) || usdt_ == address(0) || spender_ == address(0)
                || registry_ == address(0)
        ) {
            revert ZeroAddress();
        }
        owner = owner_;
        relayer = relayer_;
        usdt = usdt_;
        spender = spender_;
        registry = registry_;

        emit AccountInitialized(owner_, relayer_);
    }

    /// @notice Accepts native tokens. Allowed even when frozen, so funds can always arrive.
    receive() external payable {}

    /// @notice Sends USDT from the account. The owner, or the relayer within the grant.
    /// @param to The recipient.
    /// @param amount The amount in USDT base units.
    function sendUsdt(address to, uint256 amount) external nonReentrant whenNotFrozen {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _authorize(amount);

        IERC20(usdt).safeTransfer(to, amount);
        emit UsdtSent(to, amount);
    }

    /// @notice Runs an arbitrary call from the account. Owner only.
    /// @param target The contract or address to call.
    /// @param value Native tokens to send with the call.
    /// @param data The call data.
    /// @return The call's return data.
    function execute(address target, uint256 value, bytes calldata data)
        external
        nonReentrant
        onlyOwner
        whenNotFrozen
        returns (bytes memory)
    {
        if (target == address(0)) revert ZeroAddress();
        emit Executed(target, value);
        return Address.functionCallWithValue(target, data, value);
    }

    /// @notice Freezes the account. Owner only. No action can be taken until unfrozen. Native tokens can still arrive.
    /// @param reasonHash Hash of the reason, kept on chain.
    function freeze(bytes32 reasonHash) external onlyOwner {
        frozen = true;
        freezeReason = reasonHash;
        emit Frozen(reasonHash);
    }

    /// @notice Unfreezes the account. Owner only.
    function unfreeze() external onlyOwner {
        frozen = false;
        freezeReason = bytes32(0);
        emit Unfrozen();
    }

    /// @notice Sets a grant for the relayer, signed by the owner. Anyone can submit it; the signature is what counts.
    ///         Replaces any earlier grant and resets its usage.
    /// @param g The grant terms.
    /// @param signature The owner's signature over the grant.
    function setGrant(Grant calldata g, bytes calldata signature) external {
        if (g.relayer != relayer) revert InvalidGrantRelayer();
        if (g.nonce != nonce) revert InvalidNonce();
        if (g.expiry <= block.timestamp) revert GrantExpired();
        if (g.expiry > block.timestamp + MAX_GRANT_DURATION) revert GrantTooLong();
        if (g.maxAmount > MAX_GRANT_AMOUNT) revert GrantCapTooHigh();

        bytes32 structHash = keccak256(abi.encode(GRANT_TYPEHASH, g.relayer, g.expiry, g.maxAmount, g.nonce));
        if (ECDSA.recover(_hashTypedDataV4(structHash), signature) != owner) revert InvalidSigner();

        grant = g;
        grantUsed = 0;
        emit GrantSet(g.relayer, g.expiry, g.maxAmount, g.nonce);
    }

    /// @notice Revokes the grant at once. Old grant signatures stop working. Owner only.
    function revokeGrant() external onlyOwner {
        uint256 newNonce = ++nonce;
        delete grant;
        delete grantUsed;
        emit GrantRevoked(newNonce);
    }

    /// @notice Returns the USDT balance the account holds.
    function usdtBalance() external view returns (uint256) {
        return IERC20(usdt).balanceOf(address(this));
    }

    /// @dev Raises the spender's approval by `amount`, keeping the approval already given for other orders and plans.
    ///      The spender then takes exactly the amount of the action, so this is the only place an approval is raised.
    function _raiseSpenderApproval(uint256 amount) internal {
        uint256 current = IERC20(usdt).allowance(address(this), spender);
        IERC20(usdt).forceApprove(spender, current + amount);
    }

    /// @dev The owner acts freely. The relayer acts only within a valid grant. Each money action counts against it.
    function _authorize(uint256 amount) internal {
        if (msg.sender == owner) return;
        if (msg.sender != relayer) revert NotAuthorized();

        Grant storage g = grant;
        if (g.relayer == address(0)) revert GrantMissing();
        if (g.nonce != nonce) revert InvalidNonce();
        if (block.timestamp > g.expiry) revert GrantExpired();
        if (grantUsed + amount > g.maxAmount) revert GrantLimitExceeded();

        grantUsed += amount;
    }
}
