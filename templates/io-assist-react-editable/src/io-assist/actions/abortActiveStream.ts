import type { IoAssistStoreInstance } from "../stores";
import { MESSAGES_LOADING_STATE } from "../types";
import { logger } from "../utils/logger";
import { withAllTraceLabelsAborted } from "../utils/streamUtils";

const LOGGER_NAME = "AbortActiveStream";
const log = logger.get(LOGGER_NAME);

export function abortActiveStream(store: IoAssistStoreInstance): void {
    const state = store.getState();
    const selectedAgent = state.selectedAgent;
    const threadId = state.activeThreadId;

    if (!selectedAgent || !threadId) return;

    try {
        selectedAgent.rawAgent.abortOperation(threadId);
    } catch (error) {
        log.warn(`Failed to abort operation for thread ${threadId}: ${(error as Error)?.message ?? error}`);
    }

    const after = store.getState();
    after.abortStream(threadId);
    after.setToolTraceState(withAllTraceLabelsAborted(after.toolTraceState));
    after.setIsGeneratingResponse(false);
    after.setMessageLoadingState({ type: MESSAGES_LOADING_STATE.NOT_STARTED });
}
