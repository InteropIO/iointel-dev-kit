import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { createAgentSlice, type AgentSlice } from "./agent";
import { createAppLifecycleSlice, type AppLifecycleSlice } from "./app-lifecycle";
import { createConfirmModalSlice, type ConfirmModalSlice } from "./confirm-modal";
import { createMcpAppsSlice, type McpAppsSlice } from "./mcp-apps";
import { createMessageSlice, type MessageSlice } from "./message";
import { createPermissionModeSlice, type PermissionModeSlice } from "./permission-mode";
import { createPromptSlice, type PromptSlice } from "./prompt";
import { createResponseStreamSlice, type ResponseStreamSlice } from "./response-stream";
import { createThreadSlice, type ThreadSlice } from "./thread";
import { createToolSlice, type ToolSlice } from "./tool";
import { createWorkingContextSlice, type WorkingContextSlice } from "./working-context";

export type IoAssistStore = AppLifecycleSlice &
    AgentSlice &
    ThreadSlice &
    MessageSlice &
    ResponseStreamSlice &
    PromptSlice &
    ToolSlice &
    WorkingContextSlice &
    McpAppsSlice &
    PermissionModeSlice &
    ConfirmModalSlice;

export const createIoAssistStore = () =>
    create<IoAssistStore>()(
        subscribeWithSelector((...a) => ({
            ...createAppLifecycleSlice(...a),
            ...createAgentSlice(...a),
            ...createThreadSlice(...a),
            ...createMessageSlice(...a),
            ...createResponseStreamSlice(...a),
            ...createPromptSlice(...a),
            ...createToolSlice(...a),
            ...createWorkingContextSlice(...a),
            ...createMcpAppsSlice(...a),
            ...createPermissionModeSlice(...a),
            ...createConfirmModalSlice(...a),
        }))
    );

// Singleton instance for global usage
export const ioAssistStore = createIoAssistStore();

export type IoAssistStoreInstance = ReturnType<typeof createIoAssistStore>;

// Re-export domain types frequently imported alongside the store
export type { ConfirmModalButton, ConfirmModalConfig } from "./confirm-modal";
export type { StreamState } from "./response-stream";
export { PERMISSION_MODE } from "./permission-mode";
export type { PermissionMode } from "./permission-mode";
