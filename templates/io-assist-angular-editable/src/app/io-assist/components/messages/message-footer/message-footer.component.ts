import { CommonModule } from "@angular/common";
import { Component, inject, input, InputSignal, Signal } from "@angular/core";

import { AppCopyToClipboardButtonComponent } from "../../../shared/components/app-copy-to-clipboard-button/app-copy-to-clipboard-button.component";
import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { AppTooltipComponent } from "../../../shared/components/app-tooltip/app-tooltip.component";
import { TOOLTIP_POSITIONS } from "../../../shared/components/app-tooltip/enum";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { AnimationEffectDirective } from "../../../shared/directives/animation-effect/animation-effect.directive";
import { AnimationType } from "../../../shared/directives/animation-effect/animation-type.enum";
import { MessageFacade } from "../../../shared/store/message/message.facade";
import { responseToText } from "../../../shared/store/message/message.utils";
import { UI_MESSAGE_ROLES, UIMessage, UIUserMessage } from "../../../shared/store/message/types";
import { ThreadFacade } from "../../../shared/store/thread/thread.facade";

const MODULES = [CommonModule];
const COMPONENTS = [AppCopyToClipboardButtonComponent, AppIconComponent, AppTooltipComponent];
const DIRECTIVES = [AnimationEffectDirective];

/**
 * The message footer component is rendered below each full response message.
 *
 * Examples:
 *
 * (1) Simple response:
 * ------------- Hello (user message)
 * ------------- Hi there! How can I assist you today? (assistant message)
 * [ Copy ] [ Reload ]
 *
 * (2) Long response:
 * ------------- Hello (user message)
 * ------------- Hello how are you (assistant message)
 * ------------- (more assistant message parts)
 * ------------- (more assistant message parts)
 * ------------- (tool calls)
 * ------------- (tool calls)
 * ------------- (more assistant message parts)
 * [ Copy ] [ Reload ]
 *
 * Where the buttons in the footer allow the user to copy the entire assistant response
 * without the user message
 *
 * Or regenerate the response by re-sending the last user message
 *
 * @messageFooterId - The ID of the user message to which this footer belongs
 *                    Needed to be able to fetch the corresponding assistant messages.
 *                    The same as the id of the user message that triggered the response.
 */
@Component({
    selector: "message-footer",
    imports: [...MODULES, ...COMPONENTS, ...DIRECTIVES],
    templateUrl: "./message-footer.component.html",
})
export class MessageFooterComponent {
    public readonly messageFooterId: InputSignal<string> = input.required<string>();

    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;
    protected readonly AnimationType = AnimationType;
    protected readonly TOOLTIP_POSITIONS = TOOLTIP_POSITIONS;
    protected readonly UI_STRINGS = UI_STRINGS;

    // Provided in parent component
    private readonly _messageFacade: MessageFacade = inject(MessageFacade);
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);

    private readonly _allMessages: Signal<UIMessage[]> = this._messageFacade.allMessages;
    private readonly _activeThreadId: Signal<string | null> = this._threadFacade.activeThreadId;

    protected readonly isGeneratingResponse: Signal<boolean> = this._messageFacade.isGeneratingResponse;

    protected handleResponseToText(): string {
        return responseToText(this._allMessages(), this.messageFooterId());
    }

    protected handleRegenerateResponse() {
        const messageToReload: UIMessage = this._messageFacade.getMessageById(this.messageFooterId());

        if (messageToReload.content === "") throw new Error("Trying to reload a message with no content.");

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
