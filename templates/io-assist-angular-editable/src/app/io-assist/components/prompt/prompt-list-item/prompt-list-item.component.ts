import { CommonModule } from "@angular/common";
import { Component, computed, inject, input, InputSignal, Signal, signal, WritableSignal } from "@angular/core";

import { IconResource } from "../../../io-assist.types";
import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { APP_SPINNER_COMPONENT_SIZE } from "../../../shared/components/app-spinner/enum";
import { UIPrompt } from "../../../shared/services/prompt/types";
import { PromptFacade } from "../../../shared/store/prompt/prompt.facade";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent];

@Component({
    selector: "prompt-list-item",
    templateUrl: "./prompt-list-item.component.html",
    imports: [MODULES, COMPONENTS],
    host: {
        "[class]": "hostClasses()",
        "(mouseenter)": "handleMouseEnter()",
        "(mouseleave)": "handleMouseLeave()",
    },
})
export class PromptListItemComponent {
    public readonly prompt: InputSignal<UIPrompt> = input.required<UIPrompt>();
    public readonly isDisplayedInFavoriteList: InputSignal<boolean> = input<boolean>(false);

    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;

    private readonly _promptFacade: PromptFacade = inject(PromptFacade);

    private readonly _favoritePromptNames: Signal<string[]> = this._promptFacade.favoritePromptNames;
    protected readonly isCurrentPromptInFavorites: Signal<boolean> = computed<boolean>(() => {
        return this._favoritePromptNames().includes(this.prompt().name);
    });

    protected readonly isHostHoveredSignal: WritableSignal<boolean> = signal<boolean>(false);

    protected readonly customIcon: Signal<IconResource | undefined> = computed(() => this.prompt().icon);

    protected hostClasses: Signal<string> = computed<string>(() => {
        const baseClasses = "flex w-full";

        // Only apply width constraints on desktop for favorite lists
        if (this.isDisplayedInFavoriteList()) {
            return `${baseClasses} md:w-auto md:max-w-[352px] md:min-w-[250px] border border-border-default hover:border-border-hover rounded-2xl`;
        }

        return baseClasses;
    });

    protected handleMouseEnter(): void {
        this.isHostHoveredSignal.set(true);
    }

    protected handleMouseLeave(): void {
        this.isHostHoveredSignal.set(false);
    }

    protected handlePromptSelect(): void {
        this._promptFacade.dispatchSelectPrompt(this.prompt());
    }

    protected handlePromptToggleFavorite(event: Event): void {
        event.stopPropagation();
        event.preventDefault();

        this._promptFacade.dispatchToggleFavoritePrompt(this.prompt().name);
    }
}
