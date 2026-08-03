import { CommonModule } from "@angular/common";
import { Component, inject, input, InputSignal, output, OutputEmitterRef, Signal } from "@angular/core";

import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { MessageFacade } from "../../../shared/store/message/message.facade";
import { UIUserMessage, UI_MESSAGE_ROLES } from "../../../shared/store/message/types";
import { ThreadFacade } from "../../../shared/store/thread/thread.facade";

const COMPONENTS = [AppIconComponent];
const MODULES = [CommonModule];

@Component({
    selector: "input-area-send-button",
    imports: [...MODULES, ...COMPONENTS],
    templateUrl: "./input-area-send-button.component.html",
})
export class InputAreaSendButtonComponent {
    public readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    public readonly APP_ICON_SIZES = APP_ICON_SIZES;

    public readonly userQuery: InputSignal<string> = input.required<string>();
    public readonly onSend: OutputEmitterRef<void> = output<void>();

    // Provided in root
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);

    // Provided by parent
    private readonly _messageFacade: MessageFacade = inject(MessageFacade);

    protected readonly messageLength: Signal<number> = this._messageFacade.messageLength;
    protected readonly isGeneratingResponse: Signal<boolean> = this._messageFacade.isGeneratingResponse;
    protected readonly isLoadingMessagesFromThread: Signal<boolean> = this._messageFacade.isLoadingMessagesFromThread;
    private readonly _activeThreadId: Signal<string | null> = this._threadFacade.activeThreadId;

    public handleSendMessage(): void {
        if (this.userQuery().trim() === "") {
            return;
        }

        if (this.isGeneratingResponse() || this.isLoadingMessagesFromThread()) {
            return;
        }

        const userMessage: UIUserMessage = {
            id: crypto.randomUUID(),
            role: UI_MESSAGE_ROLES.USER,
            content: this.userQuery().trim(),
        };

        // Passing a random thread ID will create a new thread on the backend
        const activeThreadId: string = this._activeThreadId() ?? crypto.randomUUID();

        if (!this._activeThreadId()) {
            // If there is no active thread ID, we need to create a new thread
            this._threadFacade.dispatchChangeActiveThread(activeThreadId);
        }

        this._messageFacade.dispatchGetResponse(
            {
                messages: [userMessage],
            },
            activeThreadId
        );

        this.onSend.emit();
    }

    protected handleStopMessage(): void {
        const activeThreadId: string | null = this._activeThreadId();

        if (!activeThreadId) {
            return;
        }

        this._messageFacade.dispatchAbortResponseGeneration(activeThreadId);
    }
}
