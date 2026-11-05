// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IMerchantSpender
/// @notice The parts of the shared spender that smart accounts call. Customer functions act for the caller as payer or
///         subscriber. Merchant functions act for the caller as merchant of the order or subscription.
interface IMerchantSpender {
    /// @notice Pays an open order from the caller's wallet. The caller must have approved the spender for the amount.
    function payOrder(address collector) external;

    /// @notice Pays an approved refund on a withdrawn order from the merchant's wallet. Callable by the merchant or relayer.
    function pullRefund(address collector) external;

    /// @notice Creates a subscription for the merchant, with its own deposit address. Returns its id.
    function createSubscription(
        bytes32 ref,
        address merchant,
        address relayer,
        uint256 amount,
        uint256 periodLength,
        uint256 periods
    ) external returns (bytes32 id);

    /// @notice Takes an open subscription as its only customer and pays the first period.
    function subscribe(bytes32 id) external;

    /// @notice Pulls the next due period into the subscription's vault. Callable by the merchant or the relayer.
    function chargeNext(bytes32 id) external;

    /// @notice Cancels a subscription. Callable by the customer, the merchant, or the relayer.
    function cancelSubscription(bytes32 id) external;

    /// @notice The customer asks for a refund.
    function requestSubscriptionRefund(bytes32 id, bytes32 reasonHash, uint256 requestedAmount) external;

    /// @notice Refunds any amount to the customer, from the vault first and the merchant's wallet for the rest.
    function refundSubscription(bytes32 id, uint256 amount, bytes32 noteHash) external;

    /// @notice Denies the open refund request.
    function denySubscriptionRefund(bytes32 id, bytes32 noteHash) external;

    /// @notice Moves the vault's held funds to the merchant.
    function withdrawSubscription(bytes32 id) external;

    /// @notice Amount per period and number of periods.
    function subscriptionTerms(bytes32 id) external view returns (uint256 amount, uint256 periods);

    /// @notice What the subscription's vault holds right now.
    function heldBalance(bytes32 id) external view returns (uint256);
}
