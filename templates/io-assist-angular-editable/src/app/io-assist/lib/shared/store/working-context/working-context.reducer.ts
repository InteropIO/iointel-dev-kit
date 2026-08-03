import { IoIntelWorkingContext } from "@interopio/working-context";
import { createReducer, on } from "@ngrx/store";

import {
    fetchIsWorkingContextEnabled,
    fetchIsWorkingContextEnabledFailure,
    fetchIsWorkingContextEnabledSuccess,
    getWorkingContext,
    getWorkingContextFailure,
    getWorkingContextSuccess,
    updateWorkingContext,
} from "./working-context.actions";
import { LOADING_STATE } from "../../enums/loading-state.enum";
import { LoadingType } from "../../types/loading.type";

export type WorkingContextReducerStateType = {
    isEnabled: boolean;
    workingContext: Record<string, IoIntelWorkingContext.Property>;
    loadingState: LoadingType;
};

export const initialState: WorkingContextReducerStateType = {
    isEnabled: false,
    workingContext: {},
    loadingState: { type: LOADING_STATE.NOT_STARTED },
};

export const workingContextReducer = createReducer(
    initialState,
    on(
        getWorkingContext,
        (state): WorkingContextReducerStateType => ({
            ...state,
            loadingState: { type: LOADING_STATE.LOADING },
        })
    ),
    on(
        getWorkingContextSuccess,
        (state, { workingContext }): WorkingContextReducerStateType => ({
            ...state,
            workingContext,
            loadingState: { type: LOADING_STATE.SUCCESS },
        })
    ),
    on(
        getWorkingContextFailure,
        (state, { error }): WorkingContextReducerStateType => ({
            ...state,
            loadingState: { type: LOADING_STATE.ERROR, message: error.message },
        })
    ),
    on(
        updateWorkingContext,
        (state, { workingContext }): WorkingContextReducerStateType => ({
            ...state,
            workingContext,
        })
    ),
    on(fetchIsWorkingContextEnabled, (state): WorkingContextReducerStateType => ({ ...state, isEnabled: false })),
    on(
        fetchIsWorkingContextEnabledSuccess,
        (state, { isEnabled }): WorkingContextReducerStateType => ({
            ...state,
            isEnabled,
        })
    ),
    on(
        fetchIsWorkingContextEnabledFailure,
        (state, { error }): WorkingContextReducerStateType => ({
            ...state,
            loadingState: { type: LOADING_STATE.ERROR, message: error.message },
        })
    )
);
