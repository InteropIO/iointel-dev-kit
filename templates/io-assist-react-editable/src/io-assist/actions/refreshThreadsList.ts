import type { IoAssistStoreInstance } from "../stores";
import type { IoAssistDynamicConfig } from "../types";
import { refreshThreads } from "./refreshThreads";

export async function refreshThreadsList(store: IoAssistStoreInstance, dynamicConfig: IoAssistDynamicConfig): Promise<void> {
    const state = store.getState();
    const selectedAgent = state.selectedAgent;
    const ioIntelWeb = state.ioAiWebApi;

    if (!selectedAgent || !ioIntelWeb) return;

    await refreshThreads(ioIntelWeb, selectedAgent.rawAgent.id, dynamicConfig.user.id, store, true);
}
