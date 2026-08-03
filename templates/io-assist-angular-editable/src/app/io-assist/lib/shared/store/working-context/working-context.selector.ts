import { createFeatureSelector, createSelector } from "@ngrx/store";

import { WorkingContextReducerStateType } from "./working-context.reducer";

export const selectWorkingContextStore = createFeatureSelector<WorkingContextReducerStateType>("workingContextStore");

export const selectWorkingContext = createSelector(selectWorkingContextStore, (state: WorkingContextReducerStateType) => state.workingContext);

export const isWorkingContextEnabled = createSelector(selectWorkingContextStore, (state: WorkingContextReducerStateType) => state.isEnabled);
