import { inject, Injectable, Signal } from "@angular/core";
import { Store } from "@ngrx/store";

import { clearSelectedPrompt, parsePromptsConfig, selectPrompt, togglePromptFavorite } from "./prompt.actions";
import { selectAllPrompts, selectFavoritePromptNames, selectSelectedPrompt } from "./prompt.selector";
import { Prompt, UIPrompt } from "../../services/prompt/types";

@Injectable({
    providedIn: "root",
})
export class PromptFacade {
    private readonly _store: Store = inject(Store);

    private readonly _allPrompts: Signal<UIPrompt[]> = this._store.selectSignal<UIPrompt[]>(selectAllPrompts);
    public get allPrompts(): Signal<UIPrompt[]> {
        return this._allPrompts;
    }
    private readonly _favoritePromptNames: Signal<string[]> = this._store.selectSignal<string[]>(selectFavoritePromptNames);
    public get favoritePromptNames(): Signal<string[]> {
        return this._favoritePromptNames;
    }

    private readonly _selectedPrompt: Signal<Prompt | null> = this._store.selectSignal<Prompt | null>(selectSelectedPrompt);
    public get selectedPrompt(): Signal<Prompt | null> {
        return this._selectedPrompt;
    }

    public dispatchParsePromptsConfig(): void {
        this._store.dispatch(parsePromptsConfig());
    }

    public dispatchSelectPrompt(prompt: UIPrompt): void {
        this._store.dispatch(selectPrompt({ prompt }));
    }

    public dispatchToggleFavoritePrompt(name: string): void {
        this._store.dispatch(togglePromptFavorite({ name }));
    }

    public dispatchClearSelectedPrompt(): void {
        this._store.dispatch(clearSelectedPrompt());
    }
}
