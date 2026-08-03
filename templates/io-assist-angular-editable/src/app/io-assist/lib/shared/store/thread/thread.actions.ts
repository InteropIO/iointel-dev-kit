import { createAction, props } from "@ngrx/store";

import { THREAD_ACTIONS } from "./thread.actions.enum";
import { UIThread } from "./types";

export const fetchThreads = createAction(THREAD_ACTIONS.FETCH_THREADS, props<{ agentId: string }>());

export const fetchThreadsSuccess = createAction(THREAD_ACTIONS.FETCH_THREADS_SUCCESS, props<{ threads: UIThread[] }>());

export const fetchThreadsFailure = createAction(THREAD_ACTIONS.FETCH_THREADS_FAILURE, props<{ error: string }>());

export const renameThread = createAction(THREAD_ACTIONS.RENAME_THREAD, props<{ thread: UIThread; newTitle: string }>());

export const renameThreadSuccess = createAction(THREAD_ACTIONS.RENAME_THREAD_SUCCESS, props<{ id: string; newName: string }>());

export const renameThreadFailure = createAction(THREAD_ACTIONS.RENAME_THREAD_FAILURE, props<{ error: Error }>());

export const deleteThread = createAction(THREAD_ACTIONS.DELETE_THREAD, props<{ thread: UIThread }>());

export const deleteThreadSuccess = createAction(THREAD_ACTIONS.DELETE_THREAD_SUCCESS, props<{ id: string }>());

export const deleteThreadFailure = createAction(THREAD_ACTIONS.DELETE_THREAD_FAILURE, props<{ error: Error }>());

export const changeActiveThread = createAction(THREAD_ACTIONS.CHANGE_ACTIVE_THREAD, props<{ threadId: string | null }>());
