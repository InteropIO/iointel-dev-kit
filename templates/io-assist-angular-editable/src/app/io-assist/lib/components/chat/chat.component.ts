import { CommonModule } from "@angular/common";
import { Component, computed, inject, OnInit, Signal, WritableSignal } from "@angular/core";

import { IO_ASSIST_DYNAMIC_CONFIG, IoAssistDynamicConfig } from "../../io-assist.config";
import { UI_STRINGS } from "../../shared/constants/ui-strings";
import { ComponentEffectManagerService as EffectService } from "../../shared/services/component-effect-manager/component-effect-manager.service";
import { OverlayService } from "../../shared/services/overlay/overlay.service";
import { ResponsiveUIService } from "../../shared/services/responsive-ui/responsive-ui.service";
import { MessageFacade } from "../../shared/store/message/message.facade";
import { PromptFacade } from "../../shared/store/prompt/prompt.facade";
import { HeaderComponent } from "../header/header.component";
import { InputAreaComponent } from "../input-area/input-area.component";
import { MessageAreaComponent } from "../messages/message-area/message-area.component";
import { FavoritePromptListComponent } from "../prompt/favorite-prompts/favorite-prompt-list.component";
import { ThreadHistoryComponent } from "../threads/thread-history/thread-history.component";

const COMPONENTS = [ThreadHistoryComponent, FavoritePromptListComponent, InputAreaComponent, HeaderComponent, MessageAreaComponent];
const MODULES = [CommonModule];

@Component({
    selector: "chat",
    templateUrl: "./chat.component.html",
    imports: [MODULES, COMPONENTS],
    providers: [
        MessageFacade,
        PromptFacade,
        {
            provide: EffectService,
            useFactory: () => new EffectService("ChatComponent"),
        },
    ],
    host: {
        class: "flex flex-1 flex-col bg-app-background min-h-0 min-w-0 text-app-text-default",
    },
})
export class ChatComponent implements OnInit {
    protected readonly UI_STRINGS = UI_STRINGS;

    // Provided in root
    private readonly _overlayService: OverlayService = inject(OverlayService);
    private readonly _dynamicConfig: Signal<IoAssistDynamicConfig> = inject(IO_ASSIST_DYNAMIC_CONFIG);
    private readonly _responsiveUIService: ResponsiveUIService = inject(ResponsiveUIService);

    // Provided in this component
    private readonly _messageFacade: MessageFacade = inject(MessageFacade);
    private readonly _promptFacade: PromptFacade = inject(PromptFacade);
    private readonly _effectService: EffectService = inject(EffectService);

    protected readonly isLoadingMessages: Signal<boolean> = this._messageFacade.isLoadingMessages;
    protected readonly messageLength: Signal<number> = this._messageFacade.messageLength;
    protected readonly loggedInUser = computed(() => this._dynamicConfig().user.name);

    protected readonly isThreadHistoryDisplayed: WritableSignal<boolean> = this._overlayService.isThreadHistoryDisplayed;
    protected readonly hasFavoritePrompts: Signal<boolean> = computed(() => this._promptFacade.favoritePromptNames().length > 0);

    public ngOnInit(): void {
        this.registerEffects();
    }

    private registerEffects(): void {
        this._effectService.registerEffect("ChatComponent.autoCloseThreadHistoryOnViewportShrink", () => {
            if (this._responsiveUIService.isMdDown) {
                this._overlayService.isThreadHistoryDisplayed.set(false);
            }
        });
    }
}
