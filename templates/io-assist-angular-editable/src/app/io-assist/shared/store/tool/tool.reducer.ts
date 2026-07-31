import { createReducer, on } from "@ngrx/store";

import { USER_TOOL_STATE } from "./enums";
import { fetchTools, fetchToolsFailure, fetchToolsSuccess, toggleTool, toggleToolFailure, toggleToolSuccess } from "./tool.actions";
import { UITool } from "./types";
import { LOADING_STATE } from "../../enums/loading-state.enum";
import { LoadingType } from "../../types/loading.type";

export type ToolReducerStateType = {
    tools: UITool[];
    loadingState: {
        fetchingState: LoadingType;
    };
};

export const initialState: ToolReducerStateType = {
    tools: [],
    loadingState: {
        fetchingState: { type: LOADING_STATE.NOT_STARTED },
    },
};

export const toolReducer = createReducer(
    initialState,
    on(fetchTools, (state) => {
        return {
            ...state,
            loadingState: {
                fetchingState: { type: LOADING_STATE.LOADING } as LoadingType,
            },
        };
    }),
    on(fetchToolsSuccess, (state, { tools }) => {
        return {
            ...state,
            tools,
            loadingState: {
                fetchingState: { type: LOADING_STATE.SUCCESS } as LoadingType,
            },
        };
    }),
    on(fetchToolsFailure, (state, { error }) => {
        return {
            ...state,
            loadingState: {
                fetchingState: {
                    type: LOADING_STATE.ERROR,
                    message: error.message,
                } as LoadingType,
            },
        };
    }),
    on(toggleTool, (state, { tool }) => {
        return {
            ...state,
            tools: state.tools.map((t) => (t.name === tool.name ? { ...t, state: USER_TOOL_STATE.ENABLING_DISABLING } : t)),
        };
    }),
    on(toggleToolSuccess, (state, { tool }) => {
        return {
            ...state,
            tools: state.tools.map((t) => (t.name === tool.name ? { ...t, enabled: tool.enabled, state: USER_TOOL_STATE.IDLE } : t)),
        };
    }),
    on(toggleToolFailure, (state, { tool }) => {
        return {
            ...state,
            tools: state.tools.map((t) => (t.name === tool.name ? { ...t, state: USER_TOOL_STATE.IDLE } : t)),
        };
    })
);
