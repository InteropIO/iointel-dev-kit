import { createFeatureSelector, createSelector } from "@ngrx/store";

import { AppLifecycleStateType } from "./app-lifecycle.reducer";
import { LOADING_STATE } from "../../enums/loading-state.enum";

export const selectAppLifecycleStore = createFeatureSelector<AppLifecycleStateType>("appLifecycleStore");

export const selectIsAppCoreServicesStarted = createSelector(selectAppLifecycleStore, (state: AppLifecycleStateType) => state.isAppCoreServicesStarted);

export const selectAppCoreServicesLoadingState = createSelector(selectAppLifecycleStore, (state: AppLifecycleStateType) => state.loadingState);

export const selectIsPendingState = createSelector(selectAppLifecycleStore, (state: AppLifecycleStateType) => state.loadingState.type === LOADING_STATE.LOADING);
