import { createReducer, on } from "@ngrx/store";

import {
    abortThreadStream,
    addStreamToolMessage,
    clearCompletionNotification,
    completeThreadStream,
    failThreadStream,
    startThreadStream,
    untrackThreadStreamState,
    updateStreamContent,
} from "./response-stream.actions";
import { createThreadStreamState, RESPONSE_STREAM_STATUS, ThreadStreamState } from "./response-stream.types";
import { UIToolMessage } from "../message/types";

export type ResponseStreamReducerStateType = {
    streams: Record<string, ThreadStreamState>;
};

export const initialState: ResponseStreamReducerStateType = {
    streams: {},
};

export const responseStreamReducer = createReducer(
    initialState,

    on(startThreadStream, (state, { threadId, userMessage }) => {
        return {
            ...state,
            streams: {
                ...state.streams,
                [threadId]: createThreadStreamState(threadId, RESPONSE_STREAM_STATUS.STREAMING, userMessage),
            },
        };
    }),

    on(updateStreamContent, (state, { threadId, content, messageId }) => {
        const existingStream = state.streams[threadId];

        if (!existingStream || existingStream.status !== RESPONSE_STREAM_STATUS.STREAMING) {
            return state;
        }

        return {
            ...state,
            streams: {
                ...state.streams,
                [threadId]: {
                    ...existingStream,
                    accumulatedContent: content,
                    currentMessageId: messageId,
                },
            },
        };
    }),

    on(addStreamToolMessage, (state, { threadId, toolMessage }) => {
        const existingStream = state.streams[threadId];

        if (!existingStream || existingStream.status !== RESPONSE_STREAM_STATUS.STREAMING) {
            return state;
        }

        const existingToolIndex = existingStream.toolMessages.findIndex(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (t: any) => t.id === toolMessage.id
        );

        let updatedToolMessages: UIToolMessage[] | undefined = [];

        if (existingToolIndex >= 0) {
            // Update existing tool message (e.g., adding result)
            updatedToolMessages = [...existingStream.toolMessages];
            updatedToolMessages[existingToolIndex] = {
                ...updatedToolMessages[existingToolIndex],
                ...toolMessage,
            };
        }

        if (existingToolIndex < 0) {
            updatedToolMessages = [...existingStream.toolMessages, toolMessage];
        }

        return {
            ...state,
            streams: {
                ...state.streams,
                [threadId]: {
                    ...existingStream,
                    toolMessages: updatedToolMessages,
                },
            },
        };
    }),

    on(completeThreadStream, (state, { threadId, shouldNotify }) => {
        const existingStream = state.streams[threadId];

        if (!existingStream) {
            return state;
        }

        return {
            ...state,
            streams: {
                ...state.streams,
                [threadId]: {
                    ...existingStream,
                    status: RESPONSE_STREAM_STATUS.COMPLETED,
                    hasCompletionNotification: shouldNotify,
                },
            },
        };
    }),

    on(failThreadStream, (state, { threadId, errorMessage }) => {
        const existingStream = state.streams[threadId];

        if (!existingStream) {
            return state;
        }

        return {
            ...state,
            streams: {
                ...state.streams,
                [threadId]: {
                    ...existingStream,
                    status: RESPONSE_STREAM_STATUS.ERROR,
                    errorMessage,
                },
            },
        };
    }),

    on(abortThreadStream, (state, { threadId }) => {
        const existingStream = state.streams[threadId];

        if (!existingStream) {
            return state;
        }

        return {
            ...state,
            streams: {
                ...state.streams,
                [threadId]: {
                    ...existingStream,
                    status: RESPONSE_STREAM_STATUS.ABORTED,
                },
            },
        };
    }),

    on(clearCompletionNotification, (state, { threadId }) => {
        const existingStream = state.streams[threadId];

        if (!existingStream) {
            return state;
        }

        return {
            ...state,
            streams: {
                ...state.streams,
                [threadId]: {
                    ...existingStream,
                    hasCompletionNotification: false,
                },
            },
        };
    }),

    on(untrackThreadStreamState, (state, { threadId }) => {
        if (!threadId) {
            return state;
        }

        const existingStream = state.streams[threadId];

        // Only clear if stream exists and is in a terminal state
        if (!existingStream) {
            return state;
        }

        const shouldClear =
            existingStream.status === RESPONSE_STREAM_STATUS.COMPLETED || existingStream.status === RESPONSE_STREAM_STATUS.ERROR || existingStream.status === RESPONSE_STREAM_STATUS.ABORTED;

        if (!shouldClear) {
            return state;
        }

        const { [threadId]: _removed, ...remainingStreams } = state.streams;

        return {
            ...state,
            streams: remainingStreams,
        };
    })
);
