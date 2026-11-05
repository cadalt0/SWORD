// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccountBase} from "../base/AccountBase.sol";
import {IMerchantSpender} from "../../interfaces/IMerchantSpender.sol";
import {IOrderCollectorActions} from "../../interfaces/IOrderCollectorActions.sol";

/// @title CustomerAccount
/// @notice The smart account of a customer. Every customer action runs through it: pay an order, ask for a refund on
///         an order, start a subscription, cancel it, and ask for a subscription refund. The owner runs them directly.
///         The relayer runs them within the owner's grant. Payments and subscription totals count against the grant.
///         Refund requests and cancellations move no money, so they count nothing.
/// @dev The blueprint for customer accounts. Accounts are copies of it, created by the account factory.
contract CustomerAccount is AccountBase {
    /// @notice Emitted when an order is paid from the account.
    event OrderPaid(address indexed collector, uint256 amount);

    /// @notice Emitted when a refund is requested on an order paid from the account.
    event OrderRefundRequested(address indexed collector, uint256 requestedAmount);

    /// @notice Emitted when a subscription owned by the account is started.
    event SubscriptionStarted(bytes32 indexed id, uint256 totalApproved);

    /// @notice Emitted when a subscription owned by the account is cancelled.
    event SubscriptionCancelled(bytes32 indexed id);

    /// @notice Emitted when a refund is requested on a subscription owned by the account.
    event SubscriptionRefundRequested(bytes32 indexed id, uint256 requestedAmount);

    error OrderNotOpen();

    /// @notice Pays an open order from the account. The spender's approval is raised by exactly the order's amount.
    /// @param collector The order's collector.
    function payOrder(address collector) external nonReentrant whenNotFrozen {
        (bool open, uint256 amount) = IOrderCollectorActions(collector).payInfo();
        if (!open) revert OrderNotOpen();
        _authorize(amount);

        _raiseSpenderApproval(amount);
        IMerchantSpender(spender).payOrder(collector);
        emit OrderPaid(collector, amount);
    }

    /// @notice Asks for a refund on an order the account paid. Moves no money. The merchant decides.
    /// @param collector The order's collector.
    /// @param reasonHash Hash of the reason.
    /// @param requestedAmount The amount asked for. Recorded only.
    function requestOrderRefund(address collector, bytes32 reasonHash, uint256 requestedAmount)
        external
        nonReentrant
        whenNotFrozen
    {
        if (collector == address(0)) revert ZeroAddress();
        _authorize(0);

        IOrderCollectorActions(collector).requestRefund(reasonHash, requestedAmount);
        emit OrderRefundRequested(collector, requestedAmount);
    }

    /// @notice Takes an open subscription as its customer, and pays the first period. The spender's approval is raised
    ///         by the full subscription total, and that total counts against the grant.
    /// @param id The subscription id.
    function subscribe(bytes32 id) external nonReentrant whenNotFrozen {
        (uint256 amount, uint256 periods) = IMerchantSpender(spender).subscriptionTerms(id);
        uint256 total = amount * periods;
        _authorize(total);

        _raiseSpenderApproval(total);
        IMerchantSpender(spender).subscribe(id);
        emit SubscriptionStarted(id, total);
    }

    /// @notice Cancels a subscription owned by the account. Moves no money.
    /// @param id The subscription id.
    function cancelSubscription(bytes32 id) external nonReentrant whenNotFrozen {
        _authorize(0);

        IMerchantSpender(spender).cancelSubscription(id);
        emit SubscriptionCancelled(id);
    }

    /// @notice Asks for a refund on a subscription owned by the account. Moves no money. The merchant decides.
    /// @param id The subscription id.
    /// @param reasonHash Hash of the reason.
    /// @param requestedAmount The amount asked for. Recorded only.
    function requestSubscriptionRefund(bytes32 id, bytes32 reasonHash, uint256 requestedAmount)
        external
        nonReentrant
        whenNotFrozen
    {
        _authorize(0);

        IMerchantSpender(spender).requestSubscriptionRefund(id, reasonHash, requestedAmount);
        emit SubscriptionRefundRequested(id, requestedAmount);
    }
}
