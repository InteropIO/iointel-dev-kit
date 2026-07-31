import { createAction, props } from "@ngrx/store";

import { TOOL_ACTIONS } from "./tool.actions.enum";
import { UITool } from "./types";

// =========================================================================== Fetch
export const fetchTools = createAction(TOOL_ACTIONS.FETCH_TOOLS);
export const fetchToolsSuccess = createAction(TOOL_ACTIONS.FETCH_TOOLS_SUCCESS, props<{ tools: UITool[] }>());
export const fetchToolsFailure = createAction(TOOL_ACTIONS.FETCH_TOOLS_FAILURE, props<{ error: Error }>());

// =========================================================================== Enable / Disable
export const toggleTool = createAction(TOOL_ACTIONS.TOGGLE_TOOL, props<{ tool: UITool }>());
export const toggleToolSuccess = createAction(TOOL_ACTIONS.TOGGLE_TOOL_SUCCESS, props<{ tool: UITool }>());
export const toggleToolFailure = createAction(TOOL_ACTIONS.TOGGLE_TOOL_FAILURE, props<{ error: Error; tool: UITool }>());
