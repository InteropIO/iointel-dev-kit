import { CommonModule } from "@angular/common";
import { Component, computed, inject, input, InputSignal, signal, Signal, WritableSignal } from "@angular/core";

import { AppInputComponent } from "../../../shared/components/app-input/app-input.component";
import { APP_SPINNER_COMPONENT_SIZE } from "../../../shared/components/app-spinner/enum";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { UIPrompt } from "../../../shared/services/prompt/types";
import { PromptFacade } from "../../../shared/store/prompt/prompt.facade";
import { PromptListItemComponent } from "../prompt-list-item/prompt-list-item.component";

const MODULES = [CommonModule];
const COMPONENTS = [PromptListItemComponent, AppInputComponent];

type PromptGroup = {
    category: string;
    prompts: UIPrompt[];
};

const UNCATEGORIZED_CATEGORY_NAME = "Default Prompts";

@Component({
    selector: "prompt-list",
    templateUrl: "./prompt-list.component.html",
    imports: [...COMPONENTS, ...MODULES],
    providers: [PromptFacade],
})
export class PromptListComponent {
    private readonly _promptFacade: PromptFacade = inject(PromptFacade);

    public showFavoriteOnly: InputSignal<boolean> = input<boolean>(false);

    protected readonly UI_STRINGS = UI_STRINGS.PROMPT_LIST_COMPONENT;
    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;
    protected readonly UNCATEGORIZED_CATEGORY_NAME = UNCATEGORIZED_CATEGORY_NAME;

    private readonly _prompts: Signal<UIPrompt[]> = this._promptFacade.allPrompts;
    private readonly _favoritePromptNames: Signal<string[]> = this._promptFacade.favoritePromptNames;

    protected searchTerm: WritableSignal<string> = signal<string>("");

    protected readonly hasAnyPrompts: Signal<boolean> = computed(() => {
        return this._prompts().length > 0;
    });

    protected readonly promptsToDisplay: Signal<UIPrompt[]> = computed(() => {
        const showFavoriteOnly: boolean = this.showFavoriteOnly();
        const favoriteNames: string[] = this._favoritePromptNames();
        const allPrompts: UIPrompt[] = this._prompts();
        const search: string = this.searchTerm().toLowerCase();

        if (showFavoriteOnly) {
            return allPrompts.filter((p) => favoriteNames.includes(p.name));
        }

        if (search) {
            return allPrompts.filter((p) => p.name.toLowerCase().includes(search));
        }

        return allPrompts;
    });

    protected readonly promptGroups: Signal<PromptGroup[]> = computed(() => {
        if (this.showFavoriteOnly()) {
            // When showing favorites, don't group by category
            return [];
        }

        const prompts: UIPrompt[] = this.promptsToDisplay();
        const categoryMap = new Map<string, UIPrompt[]>();

        for (const prompt of prompts) {
            const category: string = prompt.category || UNCATEGORIZED_CATEGORY_NAME;
            const existingPrompts: UIPrompt[] = categoryMap.get(category) || [];

            categoryMap.set(category, [...existingPrompts, prompt]);
        }

        const groups: PromptGroup[] = Array.from(categoryMap.entries()).map(([category, prompts]) => ({
            category,
            prompts: this._sortPromptsAlphabetically(prompts),
        }));

        // Sort alphabetically, but 'Default Prompts' last
        return groups.sort((a, b) => {
            if (a.category === UNCATEGORIZED_CATEGORY_NAME) return 1;
            if (b.category === UNCATEGORIZED_CATEGORY_NAME) return -1;

            return a.category.localeCompare(b.category);
        });
    });

    private _sortPromptsAlphabetically(prompts: UIPrompt[]): UIPrompt[] {
        return [...prompts].sort((a, b) => a.name.localeCompare(b.name));
    }

    protected onDocsLinkClick(): void {
        // TODO: Provide the exact link to io-assist
        window.open("https://docs-ai.interop.io/", "_blank", "noopener,noreferrer");
    }
}
