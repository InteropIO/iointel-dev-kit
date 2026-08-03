import type { IoAssistStoreInstance } from "../stores";
import { newConversation } from "./newConversation";
import { logger } from "../utils/logger";

const LOGGER_NAME = "DeleteThread";
const log = logger.get(LOGGER_NAME);

export async function deleteThread(store: IoAssistStoreInstance, threadId: string): Promise<void> {
    const state = store.getState();
    const thread = state.threads.find((t) => t.id === threadId);
    if (!thread) return;
    const wasActive = state.activeThreadId === threadId;

    try {
        await thread.delete();
    } catch {
        log.error(`Failed to delete thread on server: ${threadId}`);
        return;
    }

    const next = store.getState();
    next.removeThread(threadId);
    next.untrackStream(threadId);

    if (wasActive) {
        await newConversation(store);
    }
}
