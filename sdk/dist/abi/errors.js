import { accountFactoryAbi } from "./account-factory.js";
import { customerAccountAbi } from "./customer-account.js";
import { merchantAccountAbi } from "./merchant-account.js";
import { merchantOrdersAbi } from "./merchant-orders.js";
import { merchantRegistryAbi } from "./merchant-registry.js";
import { merchantSpenderAbi } from "./merchant-spender.js";
import { orderCollectorAbi } from "./order-collector.js";
/// Every custom error declared by the Sword contracts, listed once by name.
export const mergedErrorAbi = dedupeByName(allItems().filter(isErrorItem));
function allItems() {
    return [
        ...merchantRegistryAbi,
        ...merchantOrdersAbi,
        ...orderCollectorAbi,
        ...merchantSpenderAbi,
        ...customerAccountAbi,
        ...merchantAccountAbi,
        ...accountFactoryAbi,
    ];
}
function isErrorItem(item) {
    return item.type === "error";
}
function dedupeByName(errors) {
    const seen = new Set();
    return errors.filter((error) => {
        if (seen.has(error.name))
            return false;
        seen.add(error.name);
        return true;
    });
}
//# sourceMappingURL=errors.js.map