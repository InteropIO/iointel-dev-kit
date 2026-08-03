import { IoAiWeb } from "@interopio/ai-web";
import { createAction, props } from "@ngrx/store";

import { MESSAGE_ACTIONS } from "./message.actions.enum";
import { GetResponseParams, ToolResult, UIAssistantMessage, UIMessage, UIResponseMessage, UIToolMessage, UIUserMessage } from "./types";
import { UIThread } from "../thread/types";

export const getResponse = createAction(
    MESSAGE_ACTIONS.GET_RESPONSE,
    props<{
        params: GetResponseParams;
        isStream?: boolean;
        agent?: IoAiWeb.Agents.Agent;
        threadId: string;
    }>()
);
export const getResponseSuccess = createAction(MESSAGE_ACTIONS.GET_RESPONSE_SUCCESS, props<{ threadId: string }>());
export const getResponseFailure = createAction(MESSAGE_ACTIONS.GET_RESPONSE_FAILURE, props<{ error: Error; threadId: string }>());

export const reloadResponse = createAction(
    MESSAGE_ACTIONS.RELOAD_RESPONSE,
    props<{
        params: GetResponseParams;
        isStream?: boolean;
        agent?: IoAiWeb.Agents.Agent;
        threadId: string;
    }>()
);

export const fetchMessagesFromThread = createAction(MESSAGE_ACTIONS.FETCH_MESSAGES_FROM_THREAD, props<{ thread: UIThread }>());

export const fetchMessagesFromThreadSuccess = createAction(MESSAGE_ACTIONS.FETCH_MESSAGES_FROM_THREAD_SUCCESS, props<{ messages: UIResponseMessage[]; threadId: string }>());

export const fetchMessagesFromThreadFailure = createAction(MESSAGE_ACTIONS.FETCH_MESSAGES_FROM_THREAD_FAILURE, props<{ error: Error }>());

/**
 * Action to merge accumulated stream content when switching to a streaming thread.
 * This ensures content streamed while the user was on another thread is not lost.
 * Includes user message (not yet in DB) and tool messages.
 */
export const mergeAccumulatedStreamContent = createAction(
    MESSAGE_ACTIONS.MERGE_ACCUMULATED_STREAM_CONTENT,
    props<{
        content: string;
        messageId: string | null;
        threadId: string;
        userMessage: UIMessage | null;
        toolMessages: UIToolMessage[];
    }>()
);

export const addUserMessage = createAction(MESSAGE_ACTIONS.ADD_USER_MESSAGE, props<{ message: UIUserMessage }>());

export const addAssistantMessage = createAction(MESSAGE_ACTIONS.ADD_ASSISTANT_MESSAGE, props<{ message: UIAssistantMessage; threadId: string }>());

export const addToolCall = createAction(MESSAGE_ACTIONS.ADD_TOOL_CALL, props<{ message: UIToolMessage; threadId: string }>());

export const updateToolCallArgs = createAction(MESSAGE_ACTIONS.UPDATE_TOOL_CALL_ARGS, props<{ toolCallId: string; args: Record<string, unknown>; threadId: string }>());

export const addToolResult = createAction(MESSAGE_ACTIONS.ADD_TOOL_RESULT, props<{ toolCallId: string; result: ToolResult; threadId: string }>());

export const abortResponseGeneration = createAction(MESSAGE_ACTIONS.ABORT_RESPONSE_GENERATION, props<{ threadId: string }>());

export const clearMessages = createAction(MESSAGE_ACTIONS.CLEAR_MESSAGES);

export const toggleToolTrace = createAction(MESSAGE_ACTIONS.TOGGLE_TOOL_TRACE, props<{ stateForMessageId: string }>());

export const toggleToolMessage = createAction(MESSAGE_ACTIONS.TOGGLE_TOOL_MESSAGE, props<{ toolMessageId: string; parentToolTraceId: string }>());
