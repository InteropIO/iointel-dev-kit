import { IoAiWeb } from "@interopio/ai-web";
import { createAction, props } from "@ngrx/store";

import { AGENT_ACTIONS } from "./agent.actions.enum";

export const listAvailableAgents = createAction(AGENT_ACTIONS.LIST_AVAILABLE_AGENTS);
export const listAvailableAgentsSuccess = createAction(AGENT_ACTIONS.LIST_AVAILABLE_AGENTS_SUCCESS, props<{ agents: IoAiWeb.Agents.Agent[] }>());
export const listAvailableAgentsFailure = createAction(AGENT_ACTIONS.LIST_AVAILABLE_AGENTS_FAILURE, props<{ error: Error }>());
export const selectAgent = createAction(AGENT_ACTIONS.SET_SELECTED_AGENT, props<{ agentId: string }>());
