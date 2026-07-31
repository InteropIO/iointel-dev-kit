import type { IoAssistStoreInstance } from "../stores";
import { updatePref } from "../utils/ioPrefs";
import { logger } from "../utils/logger";

const LOGGER_NAME = "ToggleFavoritePrompt";
const log = logger.get(LOGGER_NAME);

/**
 * Toggle a prompt's favorite status and persist the new list to
 * `io.prefs`. The store mutation is the source of truth and is kept even
 * when persistence fails — this mirrors ng's `syncFavoritePromptsInPrefs$`
 * effect, which logs the error and returns `EMPTY` without reverting the
 * store. Reverting here would hide the favorite on platforms that don't
 * support prefs writes (e.g. the platform-mcp e2e setup).
 */
export async function toggleFavoritePrompt(store: IoAssistStoreInstance, name: string): Promise<void> {
    store.getState().toggleFavoritePrompt(name);
    const after = store.getState().favoritePromptNames;

    const api = store.getState().ioConnectApi;

    try {
        await updatePref(api, "favoritePrompts", after);
    } catch (err) {
        log.error("Failed to persist favorite prompts", err instanceof Error ? err : new Error(String(err)));
    }
}
