import { IoAiWeb } from "@interopio/ai-web";

import { USER_TOOL_STATE } from "./enums";

export type ToolState = USER_TOOL_STATE.IDLE | USER_TOOL_STATE.ENABLING_DISABLING;

export type UITool = IoAiWeb.Tools.Tool & {
    state: ToolState;
};
