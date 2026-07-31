import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";
import { LOADING_STATES, type LoadingState, type UIAgent } from "../types";

export type AgentSlice = {
    agents: UIAgent[];
    selectedAgent: UIAgent | null;
    agentsLoadingState: LoadingState;
    setAgents: (agents: UIAgent[]) => void;
    setSelectedAgent: (agent: UIAgent | null) => void;
    setAgentsLoadingState: (state: LoadingState) => void;
};

export const createAgentSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], AgentSlice> = (set) => ({
    agents: [],
    selectedAgent: null,
    agentsLoadingState: { type: LOADING_STATES.NOT_STARTED },
    setAgents: (agents) => set({ agents }),
    setSelectedAgent: (agent) => set({ selectedAgent: agent }),
    setAgentsLoadingState: (state) => set({ agentsLoadingState: state }),
});
