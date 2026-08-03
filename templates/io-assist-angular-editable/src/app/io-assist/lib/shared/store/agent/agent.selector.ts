import { createFeatureSelector, createSelector } from "@ngrx/store";

import { AgentReducerStateType } from "./agent.reducer";
import { LOADING_STATE } from "../../enums/loading-state.enum";

export const selectAgentStore = createFeatureSelector<AgentReducerStateType>("agentStore");

export const selectAvailableAgents = createSelector(selectAgentStore, (state: AgentReducerStateType) => state.availableAgents);
export const selectSelectedAgent = createSelector(selectAgentStore, (state: AgentReducerStateType) => state.selectedAgent);
export const selectIsLoadingAgents = createSelector(selectAgentStore, (state: AgentReducerStateType) => state.loadingState.type === LOADING_STATE.LOADING);
