import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";
import { RESPONSE_STREAM_STATUS, type ResponseStreamStatus, type UIToolMessage, type UIUserMessage } from "../types";

export type StreamState = {
    status: ResponseStreamStatus;
    content: string;
    messageId: string | null;
    errorMessage?: string;
    userMessage: UIUserMessage | null;
    toolMessages: UIToolMessage[];
};

export type ResponseStreamSlice = {
    streamsByThreadId: Record<string, StreamState>;
    completionNotifications: string[];
    startStream: (threadId: string, userMessage: UIUserMessage | null) => void;
    updateStreamContent: (threadId: string, content: string, messageId: string) => void;
    addStreamToolMessage: (threadId: string, toolMessage: UIToolMessage) => void;
    completeStream: (threadId: string, shouldNotify: boolean) => void;
    failStream: (threadId: string, errorMessage: string) => void;
    abortStream: (threadId: string) => void;
    untrackStream: (threadId: string) => void;
    setStreamState: (threadId: string, state: Partial<StreamState>) => void;
    clearStreamState: (threadId: string) => void;
    addCompletionNotification: (threadId: string) => void;
    clearCompletionNotification: (threadId: string) => void;
    clearAllCompletionNotifications: () => void;
};

export const createResponseStreamSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], ResponseStreamSlice> = (set) => ({
    streamsByThreadId: {},
    completionNotifications: [],
    startStream: (threadId, userMessage) =>
        set((s) => ({
            streamsByThreadId: {
                ...s.streamsByThreadId,
                [threadId]: {
                    status: RESPONSE_STREAM_STATUS.STREAMING,
                    content: "",
                    messageId: null,
                    userMessage,
                    toolMessages: [],
                },
            },
        })),
    updateStreamContent: (threadId, content, messageId) =>
        set((s) => {
            const existing = s.streamsByThreadId[threadId];
            if (!existing || existing.status !== RESPONSE_STREAM_STATUS.STREAMING) return {};
            return {
                streamsByThreadId: {
                    ...s.streamsByThreadId,
                    [threadId]: { ...existing, content, messageId },
                },
            };
        }),
    addStreamToolMessage: (threadId, toolMessage) =>
        set((s) => {
            const existing = s.streamsByThreadId[threadId];
            if (!existing || existing.status !== RESPONSE_STREAM_STATUS.STREAMING) return {};
            const idx = existing.toolMessages.findIndex((t) => t.id === toolMessage.id);
            const updatedToolMessages = idx >= 0 ? existing.toolMessages.map((t, i) => (i === idx ? { ...t, ...toolMessage } : t)) : [...existing.toolMessages, toolMessage];
            return {
                streamsByThreadId: {
                    ...s.streamsByThreadId,
                    [threadId]: { ...existing, toolMessages: updatedToolMessages },
                },
            };
        }),
    completeStream: (threadId, shouldNotify) =>
        set((s) => {
            const existing = s.streamsByThreadId[threadId];
            if (!existing) return {};
            return {
                streamsByThreadId: {
                    ...s.streamsByThreadId,
                    [threadId]: { ...existing, status: RESPONSE_STREAM_STATUS.COMPLETED },
                },
                completionNotifications: shouldNotify ? [...new Set([...s.completionNotifications, threadId])] : s.completionNotifications,
            };
        }),
    failStream: (threadId, errorMessage) =>
        set((s) => {
            const existing = s.streamsByThreadId[threadId];
            if (!existing) return {};
            return {
                streamsByThreadId: {
                    ...s.streamsByThreadId,
                    [threadId]: { ...existing, status: RESPONSE_STREAM_STATUS.ERROR, errorMessage },
                },
            };
        }),
    abortStream: (threadId) =>
        set((s) => {
            const existing = s.streamsByThreadId[threadId];
            if (!existing) return {};
            return {
                streamsByThreadId: {
                    ...s.streamsByThreadId,
                    [threadId]: { ...existing, status: RESPONSE_STREAM_STATUS.ABORTED },
                },
            };
        }),
    untrackStream: (threadId) =>
        set((s) => {
            const existing = s.streamsByThreadId[threadId];
            if (!existing) return {};
            const isTerminal = existing.status === RESPONSE_STREAM_STATUS.COMPLETED || existing.status === RESPONSE_STREAM_STATUS.ERROR || existing.status === RESPONSE_STREAM_STATUS.ABORTED;
            if (!isTerminal) return {};
            const next = { ...s.streamsByThreadId };
            delete next[threadId];
            return { streamsByThreadId: next };
        }),
    setStreamState: (threadId, state) =>
        set((s) => ({
            streamsByThreadId: {
                ...s.streamsByThreadId,
                [threadId]: {
                    ...(s.streamsByThreadId[threadId] ?? {
                        status: RESPONSE_STREAM_STATUS.IDLE,
                        content: "",
                        messageId: null,
                        userMessage: null,
                        toolMessages: [],
                    }),
                    ...state,
                },
            },
        })),
    clearStreamState: (threadId) =>
        set((s) => {
            const next = { ...s.streamsByThreadId };
            delete next[threadId];
            return { streamsByThreadId: next };
        }),
    addCompletionNotification: (threadId) =>
        set((s) => ({
            completionNotifications: [...new Set([...s.completionNotifications, threadId])],
        })),
    clearCompletionNotification: (threadId) =>
        set((s) => ({
            completionNotifications: s.completionNotifications.filter((id) => id !== threadId),
        })),
    clearAllCompletionNotifications: () => set({ completionNotifications: [] }),
});
