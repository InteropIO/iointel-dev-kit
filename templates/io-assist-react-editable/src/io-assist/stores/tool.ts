import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";
import { LOADING_STATES, type LoadingState, type UITool } from "../types";

export type ToolSlice = {
    tools: UITool[];
    toolLoadingState: LoadingState;
    setTools: (tools: UITool[]) => void;
    updateToolEnabled: (name: string, enabled: boolean) => void;
    updateToolState: (name: string, toolState: UITool["state"]) => void;
    setToolLoadingState: (state: LoadingState) => void;
};

export const createToolSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], ToolSlice> = (set) => ({
    tools: [],
    toolLoadingState: { type: LOADING_STATES.NOT_STARTED },
    setTools: (tools) => set({ tools }),
    updateToolEnabled: (name, enabled) =>
        set((s) => ({
            tools: s.tools.map((t) => (t.name === name ? { ...t, enabled } : t)),
        })),
    updateToolState: (name, toolState) =>
        set((s) => ({
            tools: s.tools.map((t) => (t.name === name ? { ...t, state: toolState } : t)),
        })),
    setToolLoadingState: (state) => set({ toolLoadingState: state }),
});
