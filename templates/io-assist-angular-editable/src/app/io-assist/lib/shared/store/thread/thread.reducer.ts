import { createReducer, on } from "@ngrx/store";

import { THREAD_STATE } from "./enums";
import {
    renameThreadSuccess,
    renameThreadFailure,
    renameThread,
    fetchThreads,
    fetchThreadsFailure,
    fetchThreadsSuccess,
    changeActiveThread,
    deleteThreadSuccess,
    deleteThread,
    deleteThreadFailure,
} from "./thread.actions";
import { UIThread } from "./types";
import { LOADING_STATE } from "../../enums/loading-state.enum";
import { LoadingType } from "../../types/loading.type";

export type ThreadReducerStateType = {
    threads: UIThread[];
    activeThreadId: string | null;
    loadingState: LoadingType;
    error: string | null;
};

export const initialState: ThreadReducerStateType = {
    threads: [],
    activeThreadId: null,
    loadingState: { type: LOADING_STATE.NOT_STARTED },
    error: null,
};

export const threadReducer = createReducer(
    initialState,
    on(fetchThreads, (state) => {
        return {
            ...state,
            loadingState: { type: LOADING_STATE.LOADING as typeof LOADING_STATE.LOADING },
        };
    }),
    on(fetchThreadsSuccess, (state, { threads }) => {
        return {
            ...state,
            loadingState: {
                type: LOADING_STATE.SUCCESS as typeof LOADING_STATE.SUCCESS,
            },
            threads: threads,
            error: null,
        };
    }),
    on(fetchThreadsFailure, (state, { error }) => {
        return {
            ...state,
            loadingState: {
                type: LOADING_STATE.ERROR as typeof LOADING_STATE.ERROR,
                message: error,
            },
            error: error,
        };
    }),
    on(renameThread, (state, { thread }) => {
        return {
            ...state,
            threads: state.threads.map((t) => (t.id === thread.id ? { ...t, state: THREAD_STATE.RENAMING as const } : t)),
            error: null,
        };
    }),
    on(renameThreadSuccess, (state, { id, newName }) => {
        return {
            ...state,
            threads: state.threads.map((t) => (t.id === id ? { ...t, title: newName, state: THREAD_STATE.IDLE as const } : t)),
            error: null,
        };
    }),
    on(renameThreadFailure, (state, { error }) => {
        return {
            ...state,
            threads: state.threads.map((t) => (t.state === THREAD_STATE.RENAMING ? { ...t, state: THREAD_STATE.IDLE as const } : t)),
            error: error.message,
        };
    }),
    on(deleteThread, (state, { thread }) => {
        return {
            ...state,
            threads: state.threads.map((t) => (t.id === thread.id ? { ...t, state: THREAD_STATE.DELETING as const } : t)),
            error: null,
        };
    }),
    on(deleteThreadSuccess, (state, { id }) => {
        return {
            ...state,
            threads: state.threads.filter((t) => t.id !== id),
            activeThreadId: state.activeThreadId === id ? null : state.activeThreadId,
        };
    }),
    on(deleteThreadFailure, (state, { error }) => {
        return {
            ...state,
            threads: state.threads.map((t) => (t.state === THREAD_STATE.DELETING ? { ...t, state: THREAD_STATE.IDLE as const } : t)),
            error: error.message,
        };
    }),
    on(changeActiveThread, (state, { threadId }) => {
        return {
            ...state,
            activeThreadId: threadId,
        };
    })
);
