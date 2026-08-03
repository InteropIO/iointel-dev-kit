import { IoAiWeb } from "@interopio/ai-web";
import { createReducer, on } from "@ngrx/store";

import { listAvailableAgents, listAvailableAgentsSuccess, listAvailableAgentsFailure, selectAgent } from "./agent.actions";
import { LOADING_STATE } from "../../enums/loading-state.enum";
import { LoadingType } from "../../types/loading.type";

export type AgentReducerStateType = {
    availableAgents: IoAiWeb.Agents.Agent[];
    selectedAgent: IoAiWeb.Agents.Agent | null;
    loadingState: LoadingType;
};

export const initialState: AgentReducerStateType = {
    availableAgents: [],
    selectedAgent: null,
    loadingState: { type: LOADING_STATE.NOT_STARTED },
};

export const agentReducer = createReducer(
    initialState,
    on(
        listAvailableAgents,
        (state): AgentReducerStateType => ({
            ...state,
            loadingState: { type: LOADING_STATE.LOADING },
        })
    ),
    on(
        listAvailableAgentsSuccess,
        (state, { agents }): AgentReducerStateType => ({
            ...state,
            availableAgents: agents,
            loadingState: { type: LOADING_STATE.SUCCESS },
        })
    ),
    on(
        listAvailableAgentsFailure,
        (state, { error }): AgentReducerStateType => ({
            ...state,
            loadingState: { type: LOADING_STATE.ERROR, message: error.message },
        })
    ),
    on(
        selectAgent,
        (state, { agentId }): AgentReducerStateType => ({
            ...state,
            selectedAgent: state.availableAgents.find((agent) => agent.id === agentId) || null,
        })
    )
);
