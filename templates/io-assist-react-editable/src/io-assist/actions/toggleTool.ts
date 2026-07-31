import type { IoAssistStoreInstance } from "../stores";
import { TOOL_STATES } from "../types";
import { logger } from "../utils/logger";

const LOGGER_NAME = "ToggleTool";
const log = logger.get(LOGGER_NAME);

export async function toggleTool(store: IoAssistStoreInstance, name: string, enabled: boolean): Promise<void> {
    const state = store.getState();
    const api = state.ioAiWebApi;
    if (!api?.tools) return;

    state.updateToolState(name, TOOL_STATES.ENABLING_DISABLING);
    try {
        const updated = await api.tools.toggleTool(name, enabled);
        store.getState().updateToolEnabled(name, updated?.enabled ?? enabled);
    } catch (err) {
        log.error("toggleTool error", err instanceof Error ? err : new Error(String(err)));
    } finally {
        store.getState().updateToolState(name, TOOL_STATES.IDLE);
    }
}
