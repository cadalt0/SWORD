import { SwordError } from "./errors.js";
/// Throws unless the instance is in merchant mode. Used for actions only the merchant's own wallet may take.
export function assertMerchantMode(ctx, action) {
    if (ctx.mode !== "merchant") {
        throw new SwordError("ACTION_NOT_ALLOWED", `${action} must be done from the merchant wallet. This instance is in relayer mode.`);
    }
}
/// Throws unless the instance is in relayer mode. Used for actions only the relayer wallet may take.
export function assertRelayerMode(ctx, action) {
    if (ctx.mode !== "relayer") {
        throw new SwordError("ACTION_NOT_ALLOWED", `${action} must be done from the relayer wallet. This instance is in merchant mode.`);
    }
}
//# sourceMappingURL=mode.js.map