import type { IoAssistStoreInstance } from "../stores";
import { LOADING_STATES, TOOL_STATES } from "../types";
import type { UITool } from "../types";

export async function refreshTools(store: IoAssistStoreInstance): Promise<void> {
    const state = store.getState();
    const ioIntelWeb = state.ioAiWebApi;

    if (!ioIntelWeb) return;

    state.setToolLoadingState({ type: LOADING_STATES.LOADING });

    try {
        const rawTools = await ioIntelWeb.tools.list();

        const tools: UITool[] = rawTools.map((t) => ({
            name: t.name,
            description: t.description ?? "",
            enabled: t.enabled ?? true,
            mcpServerName: t.source?.mcpName ?? undefined,
            isSystemTool: t._meta?.io_connect_system_tool === true,
            state: TOOL_STATES.IDLE,
            rawTool: t,
        }));

        store.getState().setTools(tools);
        store.getState().setToolLoadingState({ type: LOADING_STATES.SUCCESS });
    } catch {
        store.getState().setToolLoadingState({ type: LOADING_STATES.ERROR, message: "Failed to load tools" });
    }
}
