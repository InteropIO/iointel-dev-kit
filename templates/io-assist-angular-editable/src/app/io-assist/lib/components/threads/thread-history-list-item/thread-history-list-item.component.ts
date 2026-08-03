import { CommonModule } from "@angular/common";
import { Component, computed, ElementRef, inject, input, InputSignal, Signal, signal, viewChild, WritableSignal } from "@angular/core";

import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { AppSpinnerComponent } from "../../../shared/components/app-spinner/app-spinner.component";
import { APP_SPINNER_COMPONENT_SIZE } from "../../../shared/components/app-spinner/enum";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { ComponentEffectManagerService as EffectService } from "../../../shared/services/component-effect-manager/component-effect-manager.service";
import { OverlayService } from "../../../shared/services/overlay/overlay.service";
import { ResponsiveUIService } from "../../../shared/services/responsive-ui/responsive-ui.service";
import { MessageFacade } from "../../../shared/store/message/message.facade";
import { ResponseStreamFacade } from "../../../shared/store/response-stream/response-stream.facade";
import { THREAD_STATE } from "../../../shared/store/thread/enums";
import { ThreadFacade } from "../../../shared/store/thread/thread.facade";
import { UIThread } from "../../../shared/store/thread/types";

const COMPONENTS = [AppSpinnerComponent, AppIconComponent];
const MODULES = [CommonModule];

@Component({
    selector: "thread-history-list-item",
    templateUrl: "./thread-history-list-item.component.html",
    imports: [...MODULES, ...COMPONENTS],
    providers: [
        {
            provide: EffectService,
            useFactory: () => new EffectService("ThreadHistoryListItemComponent"),
        },
    ],
})
export class ThreadHistoryListItemComponent {
    protected readonly UI_STRINGS = UI_STRINGS.GENERAL;
    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;
    protected readonly THREAD_STATE = THREAD_STATE;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;

    public readonly thread: InputSignal<UIThread> = input.required();
    protected isEditModeEnabled: WritableSignal<boolean> = signal<boolean>(false);

    protected threadNameInput: Signal<ElementRef | undefined> = viewChild<ElementRef | undefined>("threadNameInput");

    // Provided in root
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);
    private readonly _messageFacade: MessageFacade = inject(MessageFacade);
    private readonly _responseStreamFacade: ResponseStreamFacade = inject(ResponseStreamFacade);
    private readonly _overlayService: OverlayService = inject(OverlayService);
    private readonly _responsiveUIService: ResponsiveUIService = inject(ResponsiveUIService);

    // Provided in current component
    private readonly _effectService: EffectService = inject(EffectService);

    protected readonly activeThreadId: Signal<string | null> = this._threadFacade.activeThreadId;

    private readonly _streamingThreadIds: Signal<Set<string>> = this._responseStreamFacade.streamingThreadIds;
    private readonly _threadsWithNotification: Signal<string[]> = this._responseStreamFacade.threadsWithCompletionNotification;

    protected readonly isThreadStreaming: Signal<boolean> = computed(() => {
        return this._streamingThreadIds().has(this.thread().id);
    });

    protected readonly hasCompletionNotification: Signal<boolean> = computed(() => {
        return this._threadsWithNotification().includes(this.thread().id);
    });

    constructor() {
        this.registerEffects();
    }

    protected handleEditModeEnable(): void {
        this.isEditModeEnabled.set(true);
    }

    protected handleEditModeDisable(): void {
        this.isEditModeEnabled.set(false);
    }

    protected handleRenameOnBlur(newName: string): void {
        // isEditModeEnabled is set to false synchronously by handleEditModeDisable() before
        // Angular removes the input from the DOM. Removing a focused input fires blur, so
        // checking the signal here lets us skip the rename when Escape (or Enter) already
        // called handleEditModeDisable() — the blur is just an artifact of DOM removal.
        if (!this.isEditModeEnabled()) return;
        this.handleEditModeDisable();
        this.onRenameThread(newName);
    }

    protected handleThreadSelection(): void {
        if (this.isEditModeEnabled()) return;

        const threadId: string = this.thread().id;

        this._responseStreamFacade.dispatchClearCompletionNotification(threadId);

        if (threadId === this.activeThreadId()) {
            return this.handleThreadHistoryHide();
        }

        this._threadFacade.dispatchChangeActiveThread(threadId);
        this._messageFacade.dispatchFetchMessagesFromThread(this.thread());

        this.handleThreadHistoryHide();
    }

    private handleThreadHistoryHide(): void {
        if (!this._responsiveUIService.isSmDown) {
            return;
        }

        this._overlayService.isThreadHistoryDisplayed.set(false);
    }

    protected onRenameThread(newName: string): void {
        if (newName.trim() === "" || newName === this.thread().title) return;

        this._threadFacade.dispatchRenameThread(this.thread(), newName);
    }

    protected onDeleteThread(thread: UIThread): void {
        this._threadFacade.dispatchDeleteThread(thread);
    }

    private registerEffects(): void {
        this._effectService.registerEffect("ThreadHistoryListItem.focusThreadNameInput.on.isEditModeEnabled", () => this.isEditModeEnabled() && this.threadNameInput()?.nativeElement.focus());
    }
}
