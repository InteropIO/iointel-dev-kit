import { createFeatureSelector, createSelector } from "@ngrx/store";

import { ToolReducerStateType } from "./tool.reducer";
import { UITool } from "./types";
import { LOADING_STATE } from "../../enums/loading-state.enum";

export const selectToolStore = createFeatureSelector<ToolReducerStateType>("toolStore");

export const selectAllTools = createSelector(selectToolStore, (state: ToolReducerStateType) => state.tools);

export const selectToolFetchingState = createSelector(selectToolStore, (state: ToolReducerStateType) => state.loadingState.fetchingState);

export const selectIsFetchingTools = createSelector(selectToolStore, (state: ToolReducerStateType) => state.loadingState.fetchingState.type === LOADING_STATE.LOADING);

export const selectEnabledTools = createSelector(selectToolStore, (state: ToolReducerStateType) => state.tools.filter((tool: UITool) => tool.enabled));
