import { createReducer, on } from "@ngrx/store";

import { clearSelectedPrompt, parsePromptsConfig, parsePromptsConfigFailure, parsePromptsConfigSuccess, selectPrompt, togglePromptFavorite } from "./prompt.actions";
import { LOADING_STATE } from "../../enums/loading-state.enum";
import { UIPrompt } from "../../services/prompt/types";
import { LoadingType } from "../../types/loading.type";

export type PromptReducerStateType = {
    prompts: UIPrompt[];
    favoritePromptNames: string[];
    selectedPrompt: UIPrompt | null;
    loadingState: {
        fetchingState: LoadingType;
    };
};

export const initialState: PromptReducerStateType = {
    prompts: [],
    favoritePromptNames: [],
    selectedPrompt: null,
    loadingState: {
        fetchingState: { type: LOADING_STATE.NOT_STARTED },
    },
};

export const promptReducer = createReducer(
    initialState,
    on(parsePromptsConfig, (state) => {
        return {
            ...state,
            loadingState: {
                ...state.loadingState,
                fetchingState: { type: LOADING_STATE.LOADING } as LoadingType,
            },
        };
    }),
    on(parsePromptsConfigSuccess, (state, { prompts, favorites }) => {
        return {
            ...state,
            prompts,
            loadingState: {
                ...state.loadingState,
                fetchingState: { type: LOADING_STATE.SUCCESS } as LoadingType,
            },
            favoritePromptNames: favorites,
        };
    }),
    on(parsePromptsConfigFailure, (state, { error }) => {
        return {
            ...state,
            loadingState: {
                ...state.loadingState,
                fetchingState: {
                    type: LOADING_STATE.ERROR,
                    message: error.message,
                } as LoadingType,
            },
        };
    }),
    on(togglePromptFavorite, (state, { name }) => {
        if (!state.favoritePromptNames.includes(name)) {
            return {
                ...state,
                favoritePromptNames: [...state.favoritePromptNames, name],
            };
        }

        return {
            ...state,
            favoritePromptNames: state.favoritePromptNames.filter((n) => n !== name),
        };
    }),
    on(selectPrompt, (state, { prompt }) => {
        return {
            ...state,
            selectedPrompt: prompt,
        };
    }),
    on(clearSelectedPrompt, (state) => {
        return {
            ...state,
            selectedPrompt: null,
        };
    })
);
