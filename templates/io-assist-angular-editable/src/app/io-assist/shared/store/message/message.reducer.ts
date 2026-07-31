/* eslint-disable @typescript-eslint/no-explicit-any */
import { createReducer, on } from "@ngrx/store";

import {
    abortResponseGeneration,
    addAssistantMessage,
    addToolCall,
    addToolResult,
    addUserMessage,
    clearMessages,
    fetchMessagesFromThread,
    fetchMessagesFromThreadFailure,
    fetchMessagesFromThreadSuccess,
    getResponse,
    getResponseFailure,
    getResponseSuccess,
    mergeAccumulatedStreamContent,
    reloadResponse,
    toggleToolMessage,
    toggleToolTrace,
    updateToolCallArgs,
} from "./message.actions";
import {
    addToolTraceCallEntry,
    addToolTraceResultEntry,
    handleToolTraceStateOnThreadFetch,
    setDisplayFooterOnLastTrace,
    updateLastToolTraceEntry,
    updateMessageFields,
    updateToolTraceCallEntryArgs,
} from "./message.utils";
import { ToolTraceState, UIAssistantMessage, UIMessage, UIToolMessage, UI_MESSAGE_ROLES } from "./types";
import { MESSAGES_LOADING_STATE } from "../../enums/loading-state.enum";
import { MessagesLoadingType } from "../../types/loading.type";
import { changeActiveThread } from "../thread/thread.actions";

export type MessageReducerStateType = {
    messages: UIMessage[];
    loadingState: MessagesLoadingType;
    toolTraceState: ToolTraceState[];
    /** The thread ID that the current messages belong to */
    currentThreadId: string | null;
};

export const initialState: MessageReducerStateType = {
    messages: [],
    loadingState: { type: MESSAGES_LOADING_STATE.NOT_STARTED },
    toolTraceState: [],
    currentThreadId: null,
};

export const messageReducer = createReducer(
    initialState,

    on(changeActiveThread, (state, { threadId }) => {
        return {
            ...state,
            currentThreadId: threadId,
        };
    }),

    on(getResponse, (state, { params: { messages } }) => {
        const userQuery: string | string[] | UIMessage[] | any[] = messages;

        return {
            ...state,
            messages: [...state.messages, ...userQuery],
            loadingState: {
                type: MESSAGES_LOADING_STATE.LOADING_RESPONSE as typeof MESSAGES_LOADING_STATE.LOADING_RESPONSE,
            },
        };
    }),

    on(getResponseSuccess, (state) => {
        const updatedMessages: UIMessage[] = updateMessageFields(state.messages, true, true);
        const updatedToolTraceState: ToolTraceState[] = updateLastToolTraceEntry(state.toolTraceState);
        const finalToolTraceState: ToolTraceState[] = setDisplayFooterOnLastTrace(updatedToolTraceState, updatedMessages);

        return {
            ...state,
            messages: [...updatedMessages],
            loadingState: {
                type: MESSAGES_LOADING_STATE.GET_RESPONSE_SUCCESS as typeof MESSAGES_LOADING_STATE.GET_RESPONSE_SUCCESS,
            },
            toolTraceState: finalToolTraceState,
        };
    }),

    on(getResponseFailure, (state) => {
        const errorMessage: string = "Error during response generation";

        const updatedToolTraceState: ToolTraceState[] = updateLastToolTraceEntry(state.toolTraceState, true);

        return {
            ...state,
            loadingState: {
                type: MESSAGES_LOADING_STATE.ERROR,
                message: errorMessage,
            },
            toolTraceState: updatedToolTraceState,
        };
    }),

    on(reloadResponse, (state, { params: { messages } }) => {
        const userQuery: string | string[] | UIMessage[] | any[] = messages;

        return {
            ...state,
            messages: [...state.messages, ...userQuery],
            loadingState: {
                type: MESSAGES_LOADING_STATE.LOADING_RESPONSE as typeof MESSAGES_LOADING_STATE.LOADING_RESPONSE,
            },
        };
    }),

    on(clearMessages, (state) => {
        return {
            ...initialState,
            currentThreadId: state.currentThreadId,
        };
    }),

    on(fetchMessagesFromThread, (state) => {
        return {
            ...state,
            messages: [],
            loadingState: {
                type: MESSAGES_LOADING_STATE.LOADING_FROM_THREAD as typeof MESSAGES_LOADING_STATE.LOADING_FROM_THREAD,
            },
        };
    }),

    on(fetchMessagesFromThreadSuccess, (state, { messages }) => {
        const updatedMessages: UIMessage[] = updateMessageFields(messages, true, true);
        const updatedToolTraceState: ToolTraceState[] = handleToolTraceStateOnThreadFetch(updatedMessages);

        return {
            ...state,
            messages: [...updatedMessages],
            loadingState: {
                type: MESSAGES_LOADING_STATE.FETCH_MESSAGES_FROM_THREAD_SUCCESS as typeof MESSAGES_LOADING_STATE.FETCH_MESSAGES_FROM_THREAD_SUCCESS,
            },
            toolTraceState: updatedToolTraceState,
        };
    }),

    on(fetchMessagesFromThreadFailure, (state, { error }) => {
        return {
            ...state,
            loadingState: {
                type: MESSAGES_LOADING_STATE.ERROR,
                message: error.message || "Failed to fetch messages from thread",
            },
        };
    }),

    /**
     * Merge accumulated stream content when switching to a streaming thread.
     * This adds:
     * - The user message that triggered the stream (not yet in DB)
     * - Tool messages accumulated during streaming
     * - Assistant message with accumulated content (or updates existing)
     *
     * Deduplication is critical here because:
     * - DB messages may already contain some of these messages
     * - Streaming will continue after merge, adding more content
     */
    on(mergeAccumulatedStreamContent, (state, { content, messageId, userMessage, toolMessages }) => {
        let updatedMessages = [...state.messages];
        let updatedToolTraceState = [...state.toolTraceState];

        // Add user message if present and not already in messages
        if (userMessage && !updatedMessages.some((m) => m.id === userMessage.id)) {
            updatedMessages.push(userMessage);
        }

        // Add tool messages that aren't already present
        for (const toolMsg of toolMessages) {
            if (!updatedMessages.some((m) => m.id === toolMsg.id)) {
                updatedMessages.push(toolMsg);
                updatedToolTraceState = addToolTraceCallEntry(
                    {
                        ...state,
                        messages: updatedMessages,
                        toolTraceState: updatedToolTraceState,
                    },
                    toolMsg
                );
            }
        }

        // Handle assistant message with accumulated content
        if (content && content.trim() !== "") {
            // AG-UI provides stable server-assigned messageId via TEXT_MESSAGE_START,
            // so we can match directly — no fallback search needed.
            const existingAssistantIndex = updatedMessages.findIndex((m) => m.id === messageId && m.role === UI_MESSAGE_ROLES.ASSISTANT);

            if (existingAssistantIndex >= 0) {
                updatedMessages = updatedMessages.map((msg, idx) => (idx === existingAssistantIndex ? { ...msg, content, isLastMessage: true, isNew: true } : msg));
            } else {
                const accumulatedMessage: UIAssistantMessage = {
                    id: messageId ?? `accumulated-${Date.now()}`,
                    role: UI_MESSAGE_ROLES.ASSISTANT,
                    content: content,
                    isLastMessage: true,
                    isNew: true,
                };
                updatedMessages.push(accumulatedMessage);
            }
        }

        if (updatedMessages.length === state.messages.length && updatedMessages === state.messages) {
            return state;
        }

        updatedMessages = updatedMessages.map((msg, idx) => ({
            ...msg,
            isLastMessage: idx === updatedMessages.length - 1,
        }));

        return {
            ...state,
            messages: updatedMessages,
            toolTraceState: updatedToolTraceState,
            loadingState: {
                type: MESSAGES_LOADING_STATE.LOADING_RESPONSE as typeof MESSAGES_LOADING_STATE.LOADING_RESPONSE,
            },
        };
    }),

    on(addUserMessage, (state, { message }) => {
        return {
            ...state,
            messages: [...state.messages, message],
        };
    }),

    on(addAssistantMessage, (state, { message }) => {
        const updateExisting: boolean = state.messages.some((msg) => msg.id === message.id);

        if (updateExisting) {
            return {
                ...state,
                messages: state.messages.map((msg) => (msg.id === message.id ? { ...msg, content: message.content } : msg)),
            };
        }

        const updatedToolTraceState: ToolTraceState[] = updateLastToolTraceEntry(state.toolTraceState);

        return {
            ...state,
            messages: [...state.messages, message],
            toolTraceState: updatedToolTraceState,
        };
    }),

    on(addToolCall, (state, { message }) => {
        const existingToolCall = state.messages.some((msg) => msg.id === message.id);
        if (existingToolCall) {
            return state;
        }

        const updatedToolTraceState: ToolTraceState[] = addToolTraceCallEntry(state, message);

        return {
            ...state,
            messages: [...state.messages, message],
            toolTraceState: updatedToolTraceState,
        };
    }),

    on(updateToolCallArgs, (state, { toolCallId, args }) => {
        const updatedToolTraceState: ToolTraceState[] = updateToolTraceCallEntryArgs(state.toolTraceState, toolCallId, args);

        return {
            ...state,
            messages: state.messages.map((msg) => (msg.id === toolCallId ? { ...msg, args: { ...(msg as UIToolMessage).args, ...args } } : msg)),
            toolTraceState: updatedToolTraceState,
        };
    }),

    on(addToolResult, (state, { toolCallId, result }) => {
        const updatedToolTraceState: ToolTraceState[] = addToolTraceResultEntry(state.toolTraceState, toolCallId, result);

        return {
            ...state,
            messages: state.messages.map((msg) => (msg.id === toolCallId ? { ...msg, result } : msg)),
            toolTraceState: updatedToolTraceState,
        };
    }),

    on(abortResponseGeneration, (state) => {
        const updatedMessages: UIMessage[] = updateMessageFields(state.messages, true, true);
        const updatedToolTraceState: ToolTraceState[] = updateLastToolTraceEntry(state.toolTraceState, false, true);
        const finalToolTraceState: ToolTraceState[] = setDisplayFooterOnLastTrace(updatedToolTraceState, updatedMessages);

        return {
            ...state,
            messages: [...updatedMessages],
            loadingState: {
                type: MESSAGES_LOADING_STATE.NOT_STARTED as typeof MESSAGES_LOADING_STATE.NOT_STARTED,
            },
            toolTraceState: finalToolTraceState,
        };
    }),

    on(toggleToolTrace, (state, { stateForMessageId }) => {
        const updatedToolTraceState: ToolTraceState[] = state.toolTraceState.map((traceState: ToolTraceState) => {
            if (traceState.stateForMessageId === stateForMessageId) {
                return {
                    ...traceState,
                    isExpanded: !traceState.isExpanded,
                };
            }

            return traceState;
        });

        return {
            ...state,
            toolTraceState: updatedToolTraceState,
        };
    }),

    on(toggleToolMessage, (state, { toolMessageId, parentToolTraceId }) => {
        const matchingToolTraceParent: ToolTraceState | undefined = state.toolTraceState.find((traceState: ToolTraceState) => traceState.stateForMessageId === parentToolTraceId);

        if (!matchingToolTraceParent) {
            return state;
        }

        const updatedExecutedTools = matchingToolTraceParent.executedTools.map((tool) => {
            if (tool.id === toolMessageId) {
                return {
                    ...tool,
                    isExpanded: !tool.isExpanded,
                };
            }

            return tool;
        });

        const updatedToolTraceState: ToolTraceState[] = state.toolTraceState.map((traceState: ToolTraceState) => {
            if (traceState.stateForMessageId === parentToolTraceId) {
                return {
                    ...traceState,
                    executedTools: updatedExecutedTools,
                };
            }
            return traceState;
        });

        return {
            ...state,
            toolTraceState: updatedToolTraceState,
        };
    })
);
