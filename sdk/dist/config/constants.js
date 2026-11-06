/// Protocol limits and defaults. These mirror the contracts. Keep them in step with the Solidity constants.
/// The zero address, used by the contracts to mean "not set".
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
/// USDT uses 6 decimals.
export const USDT_DECIMALS = 6;
/// How long an order accepts payment after it is created or reused, in seconds.
export const ORDER_TTL_SECONDS = 20 * 60;
/// Refund window used when none is given, in days.
export const DEFAULT_REFUND_DAYS = 7;
/// Shortest and longest refund window, in days.
export const MIN_REFUND_DAYS = 1;
export const MAX_REFUND_DAYS = 365;
/// The UI should ask for renewal when a permission has this many days or fewer left.
export const RENEWAL_WARNING_DAYS = 5;
/// Longest a mandate may run from signing, in seconds.
export const MAX_MANDATE_DURATION_SECONDS = 31 * 24 * 60 * 60;
/// Hard ceilings on a mandate, in the contract's units.
export const MAX_MANDATE_ORDERS = 10000n;
export const MAX_MANDATE_ACTIONS = 10000n;
export const MAX_MANDATE_AMOUNT = 1000000000n;
/// Subscription limits: the length of one period in seconds, and the number of periods.
export const MIN_PERIOD_SECONDS = 24 * 60 * 60;
export const MAX_PERIOD_SECONDS = 365 * 24 * 60 * 60;
export const MAX_PERIODS = 120;
/// Longest a payment or refund reason may be, in characters. Only its hash is stored on chain.
export const MAX_REFERENCE_LENGTH = 128;
/// Limits on a smart account grant. These mirror the account contract.
export const MAX_ACCOUNT_GRANT_DURATION_SECONDS = 31 * 24 * 60 * 60;
export const MAX_ACCOUNT_GRANT_AMOUNT = 1000000000n;
//# sourceMappingURL=constants.js.map