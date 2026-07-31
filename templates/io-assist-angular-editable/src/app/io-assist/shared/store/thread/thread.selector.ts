import { createFeatureSelector, createSelector } from "@ngrx/store";

import { ThreadReducerStateType } from "./thread.reducer";
import { LOADING_STATE } from "../../enums/loading-state.enum";

export const selectThreadsStore = createFeatureSelector<ThreadReducerStateType>("threadsStore");

export const selectAllThreads = createSelector(selectThreadsStore, (state: ThreadReducerStateType) => state.threads);

export const selectThreadLength = createSelector(selectThreadsStore, (state: ThreadReducerStateType) => state.threads.length);

export const selectThreadLoadingState = createSelector(selectThreadsStore, (state: ThreadReducerStateType) => state.loadingState);

export const selectIsFetchingThreads = createSelector(selectThreadsStore, (state: ThreadReducerStateType) => state.loadingState.type === LOADING_STATE.LOADING);

export const selectActiveThreadId = createSelector(selectThreadsStore, (state: ThreadReducerStateType) => state.activeThreadId);

export const selectActiveThread = createSelector(selectThreadsStore, (state: ThreadReducerStateType) => state.threads.find((thread) => thread.id === state.activeThreadId) || null);
