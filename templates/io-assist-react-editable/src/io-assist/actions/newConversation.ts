import type { IoAssistStoreInstance } from "../stores";
import { logger } from "../utils/logger";

const LOGGER_NAME = "NewConversation";
const log = logger.get(LOGGER_NAME);

export async function newConversation(store: IoAssistStoreInstance): Promise<void> {
    const state = store.getState();
    state.clearMessages();
    state.setActiveThreadId(null);
    state.resetMcpApps();

    const api = state.ioAiWebApi;
    if (!api?.mcpApps) return;

    try {
        await api.mcpApps.closeAll();
    } catch (err) {
        log.error("Failed to close MCP apps on new conversation", err instanceof Error ? err : new Error(String(err)));
    }
}
