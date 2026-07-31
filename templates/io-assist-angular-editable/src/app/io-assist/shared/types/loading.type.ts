import { LOADING_STATE, MESSAGES_LOADING_STATE } from "../enums/loading-state.enum";

export type LoadingType = { type: LOADING_STATE.LOADING } | { type: LOADING_STATE.SUCCESS } | { type: LOADING_STATE.NOT_STARTED } | { type: LOADING_STATE.ERROR; message: string };

export type MessagesLoadingType =
    | { type: MESSAGES_LOADING_STATE.GET_RESPONSE_SUCCESS }
    | { type: MESSAGES_LOADING_STATE.FETCH_MESSAGES_FROM_THREAD_SUCCESS }
    | { type: MESSAGES_LOADING_STATE.LOADING_FROM_THREAD }
    | { type: MESSAGES_LOADING_STATE.LOADING_RESPONSE }
    | { type: MESSAGES_LOADING_STATE.NOT_STARTED }
    | { type: MESSAGES_LOADING_STATE.ERROR; message: string };
