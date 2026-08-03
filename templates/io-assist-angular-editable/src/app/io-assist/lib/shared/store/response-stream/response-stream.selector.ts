import { createFeatureSelector, createSelector } from "@ngrx/store";

import { ResponseStreamReducerStateType } from "./response-stream.reducer";
import { RESPONSE_STREAM_STATUS, ThreadStreamState } from "./response-stream.types";

export const selectResponseStreamStore = createFeatureSelector<ResponseStreamReducerStateType>("responseStreamStore");

export const selectAllStreams = createSelector(selectResponseStreamStore, (state: ResponseStreamReducerStateType) => state.streams);

export const selectStreamByThreadId = (threadId: string) => createSelector(selectResponseStreamStore, (state: ResponseStreamReducerStateType) => state.streams[threadId] ?? null);

export const selectIsThreadStreaming = (threadId: string) =>
    createSelector(selectResponseStreamStore, (state: ResponseStreamReducerStateType) => {
        const stream = state.streams[threadId];
        return stream?.status === RESPONSE_STREAM_STATUS.STREAMING;
    });

export const selectThreadsCurrentlyStreaming = createSelector(selectResponseStreamStore, (state: ResponseStreamReducerStateType) => {
    return Object.values(state.streams)
        .filter((stream) => stream.status === RESPONSE_STREAM_STATUS.STREAMING)
        .map((stream) => stream.threadId);
});

export const selectThreadsWithCompletionNotification = createSelector(selectResponseStreamStore, (state: ResponseStreamReducerStateType) => {
    return Object.values(state.streams)
        .filter((stream) => stream.hasCompletionNotification)
        .map((stream) => stream.threadId);
});

export const selectHasAnyCompletionNotification = createSelector(selectResponseStreamStore, (state: ResponseStreamReducerStateType) => {
    return Object.values(state.streams).some((stream) => stream.hasCompletionNotification);
});

export const selectStreamContentForThread = (threadId: string) =>
    createSelector(selectResponseStreamStore, (state: ResponseStreamReducerStateType) => {
        const stream = state.streams[threadId];
        return stream
            ? {
                  content: stream.accumulatedContent,
                  messageId: stream.currentMessageId,
                  userMessage: stream.userMessage,
                  toolMessages: stream.toolMessages,
              }
            : null;
    });

export const selectStreamingThreadIds = createSelector(selectResponseStreamStore, (state: ResponseStreamReducerStateType): Set<string> => {
    const streamingIds = Object.values(state.streams)
        .filter((stream: ThreadStreamState) => stream.status === RESPONSE_STREAM_STATUS.STREAMING)
        .map((stream: ThreadStreamState) => stream.threadId);
    return new Set(streamingIds);
});
