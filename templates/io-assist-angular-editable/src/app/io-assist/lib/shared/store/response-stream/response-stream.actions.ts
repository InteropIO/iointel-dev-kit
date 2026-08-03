import { createAction, props } from "@ngrx/store";

import { RESPONSE_STREAM_ACTIONS } from "./response-stream.actions.enum";
import { UIMessage, UIToolMessage } from "../message/types";

export const startThreadStream = createAction(RESPONSE_STREAM_ACTIONS.START_THREAD_STREAM, props<{ threadId: string; userMessage: UIMessage }>());

export const updateStreamContent = createAction(RESPONSE_STREAM_ACTIONS.UPDATE_STREAM_CONTENT, props<{ threadId: string; content: string; messageId: string }>());

export const addStreamToolMessage = createAction(RESPONSE_STREAM_ACTIONS.ADD_STREAM_TOOL_MESSAGE, props<{ threadId: string; toolMessage: UIToolMessage }>());

export const completeThreadStream = createAction(RESPONSE_STREAM_ACTIONS.COMPLETE_THREAD_STREAM, props<{ threadId: string; shouldNotify: boolean }>());

export const failThreadStream = createAction(RESPONSE_STREAM_ACTIONS.FAIL_THREAD_STREAM, props<{ threadId: string; errorMessage: string }>());

export const abortThreadStream = createAction(RESPONSE_STREAM_ACTIONS.ABORT_THREAD_STREAM, props<{ threadId: string }>());

export const clearCompletionNotification = createAction(RESPONSE_STREAM_ACTIONS.CLEAR_COMPLETION_NOTIFICATION, props<{ threadId: string }>());

export const untrackThreadStreamState = createAction(RESPONSE_STREAM_ACTIONS.UNTRACK_THREAD_STREAM_STATE, props<{ threadId: string }>());
