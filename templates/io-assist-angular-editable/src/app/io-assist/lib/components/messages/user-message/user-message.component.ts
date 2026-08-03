import { CommonModule } from "@angular/common";
import { Component, inject, input, InputSignal, Signal } from "@angular/core";

import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { AppSpinnerComponent } from "../../../shared/components/app-spinner/app-spinner.component";
import { APP_SPINNER_COMPONENT_SIZE } from "../../../shared/components/app-spinner/enum";
import { AnimationEffectDirective } from "../../../shared/directives/animation-effect/animation-effect.directive";
import { AnimationType } from "../../../shared/directives/animation-effect/animation-type.enum";
import { MessageFacade } from "../../../shared/store/message/message.facade";
import { UI_MESSAGE_ROLES, UIMessage, UIUserMessage } from "../../../shared/store/message/types";
import { ThreadFacade } from "../../../shared/store/thread/thread.facade";

const MODULES = [CommonModule];
const COMPONENTS = [AppSpinnerComponent, AppIconComponent];
const DIRECTIVES = [AnimationEffectDirective];

@Component({
    selector: "user-message",
    templateUrl: "./user-message.component.html",
    imports: [...MODULES, ...COMPONENTS, ...DIRECTIVES],
})
export class UserMessageComponent {
    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;
    protected readonly AnimationType = AnimationType;

    public readonly message: InputSignal<UIUserMessage> = input.required<UIUserMessage>();

    // Provided in parent component
    private readonly _messageFacade: MessageFacade = inject(MessageFacade);
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);

    protected readonly isGeneratingResponse: Signal<boolean> = this._messageFacade.isGeneratingResponse;
    protected readonly lastUserMessage: Signal<UIUserMessage | undefined> = this._messageFacade.lastUserMessage;
    protected readonly error: Signal<string | undefined> = this._messageFacade.loadingErrorMessage;
    private readonly _activeThreadId: Signal<string | null> = this._threadFacade.activeThreadId;

    protected reloadResponse() {
        const messageToReload: UIMessage = this.message();

        const userMessage: UIUserMessage = {
            ...messageToReload, // All others should be the same
            id: crypto.randomUUID(), // only new id is needed
            role: UI_MESSAGE_ROLES.USER, // and role explicitly set
        };

        this._messageFacade.dispatchReloadResponse(
            {
                messages: [userMessage],
            },
            this._activeThreadId()
        );
    }
}
