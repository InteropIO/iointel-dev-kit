import type { IoAssistStoreInstance } from "../stores";
import type { PermissionMode } from "../stores/permission-mode";
import { updatePref } from "../utils/ioPrefs";
import { logger } from "../utils/logger";

const LOGGER_NAME = "SetPermissionMode";
const log = logger.get(LOGGER_NAME);

/**
 * Update the permission mode and persist it to `io.prefs`. The selection always
 * applies for the session; if `prefs.update` fails (e.g. a window without an app,
 * where app prefs are unavailable) it is only logged — mirrors io-assist-ng.
 */
export async function setPermissionMode(store: IoAssistStoreInstance, mode: PermissionMode): Promise<void> {
    store.getState().setPermissionMode(mode);

    const api = store.getState().ioConnectApi;

    try {
        await updatePref(api, "permissionMode", mode);
    } catch (err) {
        log.warn(`Could not persist permission mode: ${err instanceof Error ? err.message : String(err)}`);
    }
}
