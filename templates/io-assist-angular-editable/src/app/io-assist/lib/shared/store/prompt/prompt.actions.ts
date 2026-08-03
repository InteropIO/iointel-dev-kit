import { createAction, props } from "@ngrx/store";

import { PROMPT_ACTIONS } from "./prompt.actions.enum";
import { UIPrompt } from "../../services/prompt/types";

// =========================================================================== Parse Config
export const parsePromptsConfig = createAction(PROMPT_ACTIONS.PARSE_PROMPTS_CONFIG);
export const parsePromptsConfigSuccess = createAction(PROMPT_ACTIONS.PARSE_PROMPTS_CONFIG_SUCCESS, props<{ prompts: UIPrompt[]; favorites: string[] }>());
export const parsePromptsConfigFailure = createAction(PROMPT_ACTIONS.PARSE_PROMPTS_CONFIG_FAILURE, props<{ error: Error }>());
export const selectPrompt = createAction(PROMPT_ACTIONS.SELECT_PROMPT, props<{ prompt: UIPrompt }>());
export const clearSelectedPrompt = createAction(PROMPT_ACTIONS.CLEAR_SELECTED_PROMPT);

// =========================================================================== Favorites
export const togglePromptFavorite = createAction(
    PROMPT_ACTIONS.TOGGLE_FAVORITE,
    props<{
        name: string;
    }>()
);
