export const LOADING_STATES = {
    NOT_STARTED: "not-started",
    LOADING: "loading",
    SUCCESS: "success",
    ERROR: "error",
} as const;

export type LoadingState =
    | { type: typeof LOADING_STATES.NOT_STARTED }
    | { type: typeof LOADING_STATES.LOADING }
    | { type: typeof LOADING_STATES.SUCCESS }
    | { type: typeof LOADING_STATES.ERROR; message: string };

export const MESSAGES_LOADING_STATE = {
    NOT_STARTED: "NOT_STARTED",
    LOADING_RESPONSE: "LOADING_RESPONSE",
    LOADING_FROM_THREAD: "LOADING_FROM_THREAD",
    GET_RESPONSE_SUCCESS: "GET_RESPONSE_SUCCESS",
    FETCH_MESSAGES_FROM_THREAD_SUCCESS: "FETCH_MESSAGES_FROM_THREAD_SUCCESS",
    ERROR: "ERROR",
} as const;

export type MessagesLoadingState =
    | { type: typeof MESSAGES_LOADING_STATE.NOT_STARTED }
    | { type: typeof MESSAGES_LOADING_STATE.LOADING_RESPONSE }
    | { type: typeof MESSAGES_LOADING_STATE.LOADING_FROM_THREAD }
    | { type: typeof MESSAGES_LOADING_STATE.GET_RESPONSE_SUCCESS }
    | { type: typeof MESSAGES_LOADING_STATE.FETCH_MESSAGES_FROM_THREAD_SUCCESS }
    | { type: typeof MESSAGES_LOADING_STATE.ERROR; message: string };
