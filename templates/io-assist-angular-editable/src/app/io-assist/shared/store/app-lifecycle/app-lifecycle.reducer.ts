import { createReducer, on } from "@ngrx/store";

import { initialAppCoreServicesInit, initialAppCoreServicesInitFailure, initialAppCoreServicesInitSuccess } from "./app-lifecycle.actions";
import { LOADING_STATE } from "../../enums/loading-state.enum";
import { LoadingType } from "../../types/loading.type";

export type AppLifecycleStateType = {
    isAppCoreServicesStarted: boolean;
    loadingState: LoadingType;
};

export const initialState: AppLifecycleStateType = {
    isAppCoreServicesStarted: false,
    loadingState: { type: LOADING_STATE.NOT_STARTED },
};

export const appLifecycleReducer = createReducer(
    initialState,
    on(initialAppCoreServicesInit, (state) => {
        return {
            ...state,
            loadingState: { type: LOADING_STATE.LOADING as typeof LOADING_STATE.LOADING },
        };
    }),
    on(initialAppCoreServicesInitSuccess, (state) => {
        return {
            ...state,
            isAppCoreServicesStarted: true,
            loadingState: { type: LOADING_STATE.SUCCESS as typeof LOADING_STATE.SUCCESS },
        };
    }),
    on(initialAppCoreServicesInitFailure, (state, { error }) => {
        return {
            ...state,
            isAppCoreServicesStarted: false,
            loadingState: {
                type: LOADING_STATE.ERROR as typeof LOADING_STATE.ERROR,
                message: error.message,
            },
        };
    })
);
