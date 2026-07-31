import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";
import type { Prompt } from "../types";

export type PromptSlice = {
    allPrompts: Prompt[];
    favoritePromptNames: string[];
    selectedPrompt: Prompt | null;
    setAllPrompts: (prompts: Prompt[]) => void;
    setFavoritePromptNames: (names: string[]) => void;
    toggleFavoritePrompt: (name: string) => void;
    setSelectedPrompt: (prompt: Prompt | null) => void;
};

export const createPromptSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], PromptSlice> = (set) => ({
    allPrompts: [],
    favoritePromptNames: [],
    selectedPrompt: null,
    setAllPrompts: (prompts) => set({ allPrompts: prompts }),
    setFavoritePromptNames: (names) => set({ favoritePromptNames: names }),
    toggleFavoritePrompt: (name) =>
        set((s) => {
            const isFav = s.favoritePromptNames.includes(name);
            return {
                favoritePromptNames: isFav ? s.favoritePromptNames.filter((n) => n !== name) : [...s.favoritePromptNames, name],
            };
        }),
    setSelectedPrompt: (prompt) => set({ selectedPrompt: prompt }),
});
