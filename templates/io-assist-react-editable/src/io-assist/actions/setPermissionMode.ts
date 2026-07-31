import type { IoAssistStoreInstance } from "../stores";
import type { PermissionMode } from "../stores/permission-mode";
import { updatePref } from "../utils/ioPrefs";
import { logger } from "../utils/logger";

const LOGGER_NAME = "SetPermissionMode";
const log = logger.get(LOGGER_NAME);

/**
 * Update the permission mode and persist it to `io.prefs`. The store mutation is
 * optimistic; if `prefs.update` fails, the previous value is restored.
 */
export async function setPermissionMode(store: IoAssistStoreInstance, mode: PermissionMode): Promise<void> {
    const before = store.getState().permissionMode;
    store.getState().setPermissionMode(mode);

    const api = store.getState().ioConnectApi;

    try {
        await updatePref(api, "permissionMode", mode);
    } catch (err) {
        log.error("Failed to persist permission mode", err instanceof Error ? err : new Error(String(err)));
        store.getState().setPermissionMode(before);
    }
}
