import { createFeatureSelector, createSelector } from "@ngrx/store";

import { PromptReducerStateType } from "./prompt.reducer";

export const selectPromptStore = createFeatureSelector<PromptReducerStateType>("promptStore");

export const selectAllPrompts = createSelector(selectPromptStore, (state: PromptReducerStateType) => state.prompts);

export const selectFavoritePromptNames = createSelector(selectPromptStore, (state: PromptReducerStateType) => state.favoritePromptNames);

export const selectSelectedPrompt = createSelector(selectPromptStore, (state: PromptReducerStateType) => state.selectedPrompt);
