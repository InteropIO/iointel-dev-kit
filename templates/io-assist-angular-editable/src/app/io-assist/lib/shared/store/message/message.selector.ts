import { createFeatureSelector, createSelector } from "@ngrx/store";

import { MessageReducerStateType } from "./message.reducer";
import { UI_MESSAGE_ROLES } from "./types";
import { MESSAGES_LOADING_STATE } from "../../enums/loading-state.enum";

export const selectMessageStore = createFeatureSelector<MessageReducerStateType>("messageStore");

export const selectAllMessages = createSelector(selectMessageStore, (state: MessageReducerStateType) => state.messages);

export const selectMessageLength = createSelector(selectMessageStore, (state: MessageReducerStateType) => state.messages.length);

export const selectLastUserMessage = createSelector(selectMessageStore, (state: MessageReducerStateType) => [...state.messages].reverse().find((message) => message.role === UI_MESSAGE_ROLES.USER));

export const selectIsLastUserMessage = createSelector(
    selectMessageStore,
    (state: MessageReducerStateType) => state.messages.length > 0 && state.messages[state.messages.length - 1].role === UI_MESSAGE_ROLES.USER
);

export const selectIsGeneratingResponse = createSelector(selectMessageStore, (state: MessageReducerStateType) => state.loadingState.type === MESSAGES_LOADING_STATE.LOADING_RESPONSE);

export const selectIsLoadingMessagesFromThread = createSelector(selectMessageStore, (state: MessageReducerStateType) => state.loadingState.type === MESSAGES_LOADING_STATE.LOADING_FROM_THREAD);

// covers both loading states - loading from thread and loading response
export const selectIsLoadingMessages = createSelector(
    selectMessageStore,
    (state: MessageReducerStateType) => state.loadingState.type === MESSAGES_LOADING_STATE.LOADING_FROM_THREAD || state.loadingState.type === MESSAGES_LOADING_STATE.LOADING_RESPONSE
);

export const selectIsFetchedFromThreadSuccess = createSelector(
    selectMessageStore,
    (state: MessageReducerStateType) => state.loadingState.type === MESSAGES_LOADING_STATE.FETCH_MESSAGES_FROM_THREAD_SUCCESS
);

export const selectLoadingErrorMessage = createSelector(selectMessageStore, (state: MessageReducerStateType) =>
    state.loadingState.type === MESSAGES_LOADING_STATE.ERROR ? state.loadingState.message : undefined
);

export const selectToolTraceState = createSelector(selectMessageStore, (state: MessageReducerStateType) => state.toolTraceState);

export const selectIsLastResponseSuccess = createSelector(selectMessageStore, (state: MessageReducerStateType) => state.loadingState.type === MESSAGES_LOADING_STATE.GET_RESPONSE_SUCCESS);
