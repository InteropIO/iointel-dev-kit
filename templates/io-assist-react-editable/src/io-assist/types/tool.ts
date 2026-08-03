import type { IoAiWeb } from "@interopio/ai-web";

export const TOOL_STATES = {
    IDLE: "IDLE",
    ENABLING_DISABLING: "ENABLING_DISABLING",
} as const;

export type ToolState = (typeof TOOL_STATES)[keyof typeof TOOL_STATES];

export type UITool = {
    name: string;
    description: string;
    enabled: boolean;
    icon?: string;
    mcpServerName?: string;
    state: ToolState;
    rawTool: IoAiWeb.Tools.Tool;
};
