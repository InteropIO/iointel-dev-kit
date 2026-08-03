import type { IoAssistStoreInstance } from "../stores";
import { MESSAGES_LOADING_STATE, RESPONSE_STREAM_STATUS, UI_MESSAGE_ROLES } from "../types";
import type { UIMessage, UIToolMessage } from "../types";
import { logger } from "../utils/logger";
import { convertThreadMessages } from "../utils/messageConverter";
import { buildToolTraceFromMessages } from "../utils/threadUtils";

const LOGGER_NAME = "SelectThread";
const log = logger.get(LOGGER_NAME);

export async function selectThread(store: IoAssistStoreInstance, threadId: string): Promise<void> {
    const state = store.getState();
    const thread = state.threads.find((t) => t.id === threadId);

    state.clearCompletionNotification(threadId);

    if (state.activeThreadId && state.activeThreadId !== threadId) {
        state.untrackStream(state.activeThreadId);
    }

    state.setActiveThreadId(threadId);
    state.clearMessages();
    state.resetMcpApps();
    state.setIsThreadHistoryVisible(false);

    if (!thread) return;

    state.setMessageLoadingState({ type: MESSAGES_LOADING_STATE.LOADING_FROM_THREAD });
    try {
        const response = await thread.getMessages({ limit: 100 });
        // `IoAiWeb.Threads.GetMessagesResponse.messages` is itself `any[]` upstream — the
        // shape isn't typed on the d.ts. Treat as `unknown[]` at this boundary and let
        // `convertThreadMessages` narrow via type-guards.
        const rawMessages: unknown[] = Array.isArray(response) ? response : (response?.messages ?? []);

        const messages: UIMessage[] = convertThreadMessages(rawMessages);
        const toolTraces = buildToolTraceFromMessages(messages);
        store.getState().setMessages(messages);
        store.getState().setToolTraceState(toolTraces);

        // Restore MCP app instances for the thread — mirrors ng's
        // createMcpAppsOnThreadFetch$ effect. Without this, reopening a
        // thread leaves the workspace windows empty because the SDK
        // doesn't reattach app instances on its own.
        const mcpApps = store.getState().ioAiWebApi?.mcpApps;
        if (mcpApps) {
            const apps = messages
                .filter((m): m is UIToolMessage => m.role === UI_MESSAGE_ROLES.TOOL)
                .map((m) => ({
                    toolCallId: m.id,
                    toolName: m.toolName,
                    toolInput: m.args,
                    toolResult: m.result,
                }));
            const restoreApps = apps.length > 0 ? mcpApps.recreate({ threadId, apps }) : mcpApps.closeAll();
            Promise.resolve(restoreApps).catch((err: unknown) => log.error("Failed to restore MCP apps on thread reopen", err as Error));
        }

        const threadStream = store.getState().streamsByThreadId[threadId];
        if (threadStream?.status === RESPONSE_STREAM_STATUS.STREAMING) {
            store.getState().mergeAccumulatedStreamContent(threadId);
        }

        store.getState().setMessageLoadingState({
            type: MESSAGES_LOADING_STATE.FETCH_MESSAGES_FROM_THREAD_SUCCESS,
        });
    } catch (error) {
        store.getState().setMessageLoadingState({
            type: MESSAGES_LOADING_STATE.ERROR,
            message: error instanceof Error ? error.message : "Failed to load messages",
        });
    }
}
