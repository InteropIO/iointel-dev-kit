import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";
import { MESSAGES_LOADING_STATE, type MessagesLoadingState, type ToolTraceState, type UIMessage } from "../types";

export type MessageSlice = {
    messages: UIMessage[];
    isGeneratingResponse: boolean;
    messageLoadingState: MessagesLoadingState;
    isLastResponseSuccess: boolean;
    toolTraceState: ToolTraceState[];
    /**
     * Monotonically-increasing counter incremented every time we want the chat
     * to snap the latest content to the top of the visible viewport (imperative
     * one-shot trigger, called from `sendUserMessage`). ScrollArea subscribes
     * and reacts to each tick.
     */
    scrollAnchorRequestId: number;
    setMessages: (messages: UIMessage[]) => void;
    addMessage: (message: UIMessage) => void;
    updateMessage: (id: string, changes: Partial<UIMessage>) => void;
    clearMessages: () => void;
    setIsGeneratingResponse: (generating: boolean) => void;
    setMessageLoadingState: (state: MessagesLoadingState) => void;
    setIsLastResponseSuccess: (success: boolean) => void;
    setToolTraceState: (state: ToolTraceState[]) => void;
    toggleToolTrace: (messageId: string) => void;
    toggleToolMessage: (toolMessageId: string, parentId: string) => void;
    mergeAccumulatedStreamContent: (threadId: string) => void;
    requestScrollAnchor: () => void;
};

export const createMessageSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], MessageSlice> = (set) => ({
    messages: [],
    isGeneratingResponse: false,
    messageLoadingState: { type: MESSAGES_LOADING_STATE.NOT_STARTED },
    isLastResponseSuccess: false,
    toolTraceState: [],
    scrollAnchorRequestId: 0,
    requestScrollAnchor: () => set((s) => ({ scrollAnchorRequestId: s.scrollAnchorRequestId + 1 })),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
    updateMessage: (id, changes) =>
        set((s) => ({
            messages: s.messages.map((m) => (m.id === id ? ({ ...m, ...changes } as UIMessage) : m)),
        })),
    clearMessages: () =>
        set({
            messages: [],
            toolTraceState: [],
            isLastResponseSuccess: false,
            messageLoadingState: { type: MESSAGES_LOADING_STATE.NOT_STARTED },
        }),
    setIsGeneratingResponse: (generating) => set({ isGeneratingResponse: generating }),
    setMessageLoadingState: (state) => set({ messageLoadingState: state }),
    setIsLastResponseSuccess: (success) => set({ isLastResponseSuccess: success }),
    setToolTraceState: (state) => set({ toolTraceState: state }),
    toggleToolTrace: (messageId) =>
        set((s) => ({
            toolTraceState: s.toolTraceState.map((t) => (t.stateForMessageId === messageId ? { ...t, isExpanded: !t.isExpanded } : t)),
        })),
    toggleToolMessage: (toolMessageId, parentId) =>
        set((s) => ({
            toolTraceState: s.toolTraceState.map((t) =>
                t.stateForMessageId === parentId
                    ? {
                          ...t,
                          executedTools: t.executedTools.map((tool) => (tool.id === toolMessageId ? { ...tool, isExpanded: !tool.isExpanded } : tool)),
                      }
                    : t
            ),
        })),
    mergeAccumulatedStreamContent: (threadId) =>
        set((s) => {
            const stream = s.streamsByThreadId[threadId];
            if (!stream) return {};

            let updatedMessages = [...s.messages];

            if (stream.userMessage && !updatedMessages.some((m) => m.id === stream.userMessage!.id)) {
                updatedMessages.push(stream.userMessage);
            }

            for (const toolMsg of stream.toolMessages) {
                if (!updatedMessages.some((m) => m.id === toolMsg.id)) {
                    updatedMessages.push(toolMsg);
                }
            }

            // Anchor for the assistant bubble and its tool trace. Fall back to a
            // synthesised id only when buffered tools exist without any assistant
            // text — we still need a stable parent id for the trace.
            const assistantId = stream.messageId ?? (stream.toolMessages.length > 0 ? `accumulated-${Date.now()}` : null);

            if (stream.content && stream.content.trim() !== "") {
                const existingIdx = updatedMessages.findIndex((m) => m.id === assistantId && m.role === "assistant");

                if (existingIdx >= 0) {
                    updatedMessages = updatedMessages.map((msg, idx) => (idx === existingIdx ? { ...msg, content: stream.content } : msg));
                } else if (assistantId) {
                    updatedMessages.push({
                        id: assistantId,
                        role: "assistant" as const,
                        content: stream.content,
                    });
                }
            } else if (assistantId && stream.toolMessages.length > 0 && !updatedMessages.some((m) => m.id === assistantId && m.role === "assistant")) {
                updatedMessages.push({
                    id: assistantId,
                    role: "assistant" as const,
                    content: "",
                });
            }

            let nextToolTraceState = s.toolTraceState;
            if (assistantId && stream.toolMessages.length > 0) {
                const n = stream.toolMessages.length;
                const trace: ToolTraceState = {
                    stateForMessageId: assistantId,
                    executedTools: stream.toolMessages,
                    uiMessage: `Used ${n} tool${n !== 1 ? "s" : ""}`,
                    isExpanded: false,
                };
                const existingIdx = nextToolTraceState.findIndex((t) => t.stateForMessageId === assistantId);
                nextToolTraceState = existingIdx >= 0 ? nextToolTraceState.map((t, i) => (i === existingIdx ? trace : t)) : [...nextToolTraceState, trace];
            }

            const messagesChanged = updatedMessages.length !== s.messages.length;
            const tracesChanged = nextToolTraceState !== s.toolTraceState;
            if (!messagesChanged && !tracesChanged) return {};

            const patch: Partial<Pick<MessageSlice, "messages" | "toolTraceState">> = {};
            if (messagesChanged) patch.messages = updatedMessages;
            if (tracesChanged) patch.toolTraceState = nextToolTraceState;
            return patch;
        }),
});
