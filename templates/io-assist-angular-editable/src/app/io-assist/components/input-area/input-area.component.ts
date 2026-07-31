import { CommonModule } from "@angular/common";
import { Component, computed, ElementRef, inject, Signal, signal, viewChild, WritableSignal, OnInit } from "@angular/core";

import { InputAreaActionBarComponent } from "./input-area-action-bar/input-area-action-bar.component";
import { InputAreaSendButtonComponent } from "./input-area-send-button/input-area-send-button.component";
import { UI_STRINGS } from "../../shared/constants/ui-strings";
import { AccentGradientBorderDirective } from "../../shared/directives/accent-gradient-border/accent-gradient-border.directive";
import { AnimationType } from "../../shared/directives/animation-effect/animation-type.enum";
import { ComponentEffectManagerService as EffectService } from "../../shared/services/component-effect-manager/component-effect-manager.service";
import { Prompt } from "../../shared/services/prompt/types";
import { MessageFacade } from "../../shared/store/message/message.facade";
import { UI_MESSAGE_ROLES, UIMessage, UIUserMessage } from "../../shared/store/message/types";
import { PromptFacade } from "../../shared/store/prompt/prompt.facade";

const COMPONENTS = [InputAreaActionBarComponent, InputAreaSendButtonComponent];
const DIRECTIVES = [AccentGradientBorderDirective];
const MODULES = [CommonModule];

@Component({
    selector: "input-area",
    templateUrl: "./input-area.component.html",
    styleUrl: "./input-area.component.css",
    imports: [...COMPONENTS, ...MODULES, ...DIRECTIVES],
    providers: [
        PromptFacade,
        {
            provide: EffectService,
            useFactory: () => new EffectService("InputAreaComponent"),
        },
    ],
})
export class InputAreaComponent implements OnInit {
    protected inputValue: WritableSignal<string> = signal<string>("");
    protected isAnimationComplete: WritableSignal<boolean> = signal<boolean>(false);

    protected readonly UI_STRINGS = UI_STRINGS.INPUT_COMPONENT;
    protected readonly AnimationType = AnimationType;
    protected readonly sendButton: Signal<InputAreaSendButtonComponent | undefined> = viewChild(InputAreaSendButtonComponent);
    protected readonly inputAreaRef: Signal<ElementRef | undefined> = viewChild<ElementRef>("inputTextArea");

    // Provided in current component
    private readonly _promptFacade: PromptFacade = inject(PromptFacade);
    private readonly _effectService: EffectService = inject(EffectService);

    // Provided by parent
    private readonly _messageFacade: MessageFacade = inject(MessageFacade);
    private readonly _userMessages: Signal<UIUserMessage[]> = computed<UIUserMessage[]>(() => {
        const allMessages: UIMessage[] = this._messageFacade.allMessages();

        return allMessages.filter((message: UIMessage) => message.role === UI_MESSAGE_ROLES.USER);
    });
    private readonly _currentUserMessage: WritableSignal<UIUserMessage | null> = signal<UIUserMessage | null>(null);

    private readonly _selectedPrompt: Signal<Prompt | null> = this._promptFacade.selectedPrompt;

    public ngOnInit(): void {
        this.registerEffects();
    }

    protected handleInputChange(event: Event): void {
        const target: HTMLTextAreaElement = event.target as HTMLTextAreaElement;

        this.setInputValue(target.value);
    }

    protected handleAnimationStart(): void {
        this.isAnimationComplete.set(false);
    }

    protected handleAnimationEnd(): void {
        this.isAnimationComplete.set(true);
    }

    protected setInputValue(value: string): void {
        this.inputValue.set(value);

        const shouldResetDefaultSize: boolean = value.trim() === "";

        // Use queueMicrotask to ensure textarea DOM updates are applied before calculating scrollHeight for resize
        queueMicrotask(() => this.resizeTextArea(shouldResetDefaultSize));
    }

    protected handleKeyDown(event: KeyboardEvent): void {
        if (event.key === "Enter" && event.shiftKey) {
            return;
        }

        if (event.key === "Enter") {
            // Prevent adding a new line
            event.preventDefault();

            // send message
            this.sendButton()?.handleSendMessage();
            return;
        }

        if (event.key === "ArrowUp" && event.shiftKey) {
            this.browseUserMessages("up");
        }

        if (event.key === "ArrowDown" && event.shiftKey) {
            this.browseUserMessages("down");
        }
    }

    private browseUserMessages(direction: "up" | "down"): void {
        const userMessages: UIUserMessage[] = this._userMessages();

        if (userMessages.length === 0) {
            return;
        }

        const currentMessage: UIUserMessage | null = this._currentUserMessage();

        const isAtFirstMessage: boolean = currentMessage?.id === this._userMessages()[0].id && direction === "up";

        if (isAtFirstMessage) {
            return;
        }

        const hasReachedLast: boolean = this._currentUserMessage()?.id === this._userMessages()[this._userMessages().length - 1].id && direction === "down";

        if (hasReachedLast) {
            return;
        }

        const currentMessageExists: boolean = currentMessage !== null && userMessages.some((msg: UIUserMessage) => msg.id === currentMessage.id);

        if (!currentMessageExists) {
            const index: number = direction === "up" ? userMessages.length - 1 : 0;

            this._currentUserMessage.set(userMessages[index]);

            return;
        }

        const currentMessageIndex: number = userMessages.findIndex((msg: UIUserMessage) => msg.id === currentMessage?.id);

        if (direction === "up") {
            const index: number = currentMessageIndex > 0 ? currentMessageIndex - 1 : 0;

            this._currentUserMessage.set(userMessages[index]);

            return;
        }

        const index: number = currentMessageIndex < userMessages.length - 1 ? currentMessageIndex + 1 : userMessages.length - 1;

        this._currentUserMessage.set(userMessages[index]);
    }

    private resizeTextArea(shouldResetDefault: boolean): void {
        const textarea: HTMLTextAreaElement | undefined = this.inputAreaRef()?.nativeElement;

        if (!textarea) {
            return;
        }

        textarea.style.height = "17px"; // Always reset to initial height

        if (!shouldResetDefault) {
            textarea.style.height = Math.min(textarea.scrollHeight, 260) + "px";

            return;
        }
    }

    private registerEffects(): void {
        this._effectService.registerEffect("InputArea.updatesInputValue.on.currentUserMessage", () => {
            const currentMessage = this._currentUserMessage();

            if (currentMessage === null) {
                return;
            }

            this.setInputValue(currentMessage.content || "");
        });

        this._effectService.registerEffect("InputArea.updatesInputValue.on.selectedPrompt", () => {
            const prompt = this._selectedPrompt();

            if (!prompt) return;

            const description = prompt?.description;

            if (description === undefined || description == null || description.trim() === "") {
                return;
            }

            this.setInputValue(description);

            this._promptFacade.dispatchClearSelectedPrompt();
        });
    }
}
