import type { IoAiWeb } from "@interopio/ai-web";

import type { IoAssistStoreInstance } from "../stores";
import { UI_MESSAGE_ROLES, MESSAGES_LOADING_STATE } from "../types";
import type { IoAssistDynamicConfig, UIThread, UIUserMessage } from "../types";
import { processResponseStream } from "./processResponseStream";
import { logger } from "../utils/logger";
import { safeStringify } from "../utils/safeStringify";

const LOGGER_NAME = "SendUserMessage";
const log = logger.get(LOGGER_NAME);

export async function sendUserMessage(store: IoAssistStoreInstance, text: string, dynamicConfig: IoAssistDynamicConfig): Promise<void> {
    log.debug(`sendUserMessage called with text: ${text}`);
    const state = store.getState();
    const selectedAgent = state.selectedAgent;
    const ioIntelWeb = state.ioAiWebApi;

    if (!selectedAgent || !ioIntelWeb) {
        throw new Error("Agent or IoAiWeb API not ready");
    }

    let threadId = state.activeThreadId;
    if (!threadId) {
        threadId = crypto.randomUUID();
        state.setActiveThreadId(threadId);
    }

    const userId = dynamicConfig.user.id;
    const userMessage: UIUserMessage = {
        id: crypto.randomUUID(),
        role: UI_MESSAGE_ROLES.USER,
        content: text,
    };

    state.addMessage(userMessage);
    // One-shot imperative snap: pin the just-sent message to the top of the
    // visible chat. Done here so it fires for both InputArea-driven sends and
    // any other call site of sendUserMessage (e.g. MCP-app message forwarding).
    state.requestScrollAnchor();
    state.setIsGeneratingResponse(true);
    state.setIsLastResponseSuccess(false);
    state.setMessageLoadingState({ type: MESSAGES_LOADING_STATE.LOADING_RESPONSE });

    // Send only the new user message — the server reconstructs conversation
    // history from thread memory. Sending all UI messages caused duplicates
    // because the server was writing them again on top of what it already had.
    // Mirrors Angular's input-area-send-button which passes only [userMessage].
    const streamParams = {
        messages: [{ id: userMessage.id, role: userMessage.role, content: userMessage.content ?? "" }],
        memory: { thread: threadId, resource: userId },
        resourceId: userId,
        tools: { autoIncludeEnabled: true },
    };

    try {
        log.debug(`Initiating agent stream with params: ${safeStringify(streamParams)}`);
        const runHandle = await selectedAgent.rawAgent.stream(streamParams);

        // Store userMessage in stream state before streaming begins
        // (mirrors Angular's _dispatchStreamForThread)
        store.getState().startStream(threadId, userMessage);

        await processResponseStream(runHandle, threadId, store, () => store.getState().activeThreadId === threadId);

        await refreshThreads(ioIntelWeb, selectedAgent.rawAgent.id, userId, store);
    } catch (error) {
        state.setIsGeneratingResponse(false);
        state.setIsLastResponseSuccess(false);
        state.setMessageLoadingState({
            type: MESSAGES_LOADING_STATE.ERROR,
            message: error instanceof Error ? error.message : "Error during response generation",
        });
        log.error("Send message failed", error instanceof Error ? error : new Error(String(error)));
    }
}

async function refreshThreads(ioIntelWeb: IoAiWeb.API, agentId: string, userId: string, store: IoAssistStoreInstance): Promise<void> {
    try {
        const rawThreads = await ioIntelWeb.threads.list({ agentId, resourceId: userId });

        const threads: UIThread[] = rawThreads.map((t) => ({
            id: t.id,
            title: t.title || t.id.substring(0, 8),
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
            rawThread: t,
            update: (params: { title: string }) => t.update(params),
            delete: () => t.delete(),
            getMessages: (params: { limit: number }) => t.getMessages(params),
        }));

        store.getState().setThreads(threads);
    } catch {
        // Non-critical – silently ignore
    }
}
