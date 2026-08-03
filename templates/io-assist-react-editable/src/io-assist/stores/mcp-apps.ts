import type { IoAiWeb } from "@interopio/ai-web";
import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";

export type McpAppsSlice = {
    mcpAppInstances: IoAiWeb.McpApps.AppInstance[];
    addMcpApp: (instance: IoAiWeb.McpApps.AppInstance) => void;
    removeMcpApp: (instanceId: string) => void;
    resetMcpApps: () => void;
};

export const createMcpAppsSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], McpAppsSlice> = (set) => ({
    mcpAppInstances: [],
    addMcpApp: (instance) =>
        set((s) => {
            if (s.mcpAppInstances.find((a) => a.id === instance.id)) return {};
            return { mcpAppInstances: [...s.mcpAppInstances, instance] };
        }),
    removeMcpApp: (instanceId) =>
        set((s) => ({
            mcpAppInstances: s.mcpAppInstances.filter((a) => a.id !== instanceId),
        })),
    resetMcpApps: () => set({ mcpAppInstances: [] }),
});
