import { CommonModule } from "@angular/common";
import { Component, inject, OnInit, Signal, WritableSignal } from "@angular/core";

import { APP_BUTTON_TYPES } from "../../shared/components/app-button/enum";
import { AppIconComponent } from "../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../shared/components/app-icon/enum";
import { PANEL_BUTTON_ACTION_TYPE } from "../../shared/components/app-panel/enums";
import { APP_SPINNER_COMPONENT_SIZE } from "../../shared/components/app-spinner/enum";
import { AppTooltipComponent } from "../../shared/components/app-tooltip/app-tooltip.component";
import { TOOLTIP_POSITIONS } from "../../shared/components/app-tooltip/enum";
import { UI_STRINGS } from "../../shared/constants/ui-strings";
import { AnimationType } from "../../shared/directives/animation-effect/animation-type.enum";
import { OverlayService } from "../../shared/services/overlay/overlay.service";
import { MessageFacade } from "../../shared/store/message/message.facade";
import { ResponseStreamFacade } from "../../shared/store/response-stream/response-stream.facade";
import { ThreadFacade } from "../../shared/store/thread/thread.facade";
import { WorkingContextFacade } from "../../shared/store/working-context/working-context.facade";
import { WorkingContextPanelComponent } from "../working-context-panel/working-context-panel.component";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent, AppTooltipComponent];

@Component({
    selector: "header",
    templateUrl: "./header.component.html",
    imports: [...MODULES, ...COMPONENTS],
    providers: [WorkingContextFacade],
    host: {
        style: "display: flex; width: 100%;",
    },
})
export class HeaderComponent implements OnInit {
    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;
    protected readonly UI_STRINGS = UI_STRINGS;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;
    protected readonly AnimationType = AnimationType;
    protected readonly TOOLTIP_POSITIONS = TOOLTIP_POSITIONS;

    // Provided in root
    private readonly _overlayService: OverlayService = inject(OverlayService);
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);
    private readonly _responseStreamFacade: ResponseStreamFacade = inject(ResponseStreamFacade);

    // Provided by parent component
    private readonly _messageFacade: MessageFacade = inject(MessageFacade);

    // Provided in this component
    private readonly _workingContextFacade: WorkingContextFacade = inject(WorkingContextFacade);

    protected readonly isThreadHistoryDisplayed: WritableSignal<boolean> = this._overlayService.isThreadHistoryDisplayed;
    protected readonly isLoadingMessages: Signal<boolean> = this._messageFacade.isLoadingMessages;
    protected readonly messageLength: Signal<number> = this._messageFacade.messageLength;
    protected readonly isWorkingContextEnabled: Signal<boolean> = this._workingContextFacade.isWorkingContextEnabled;
    protected readonly hasAnyCompletionNotification: Signal<boolean> = this._responseStreamFacade.hasAnyCompletionNotification;

    public ngOnInit(): void {
        this._workingContextFacade.dispatchFetchIsWorkingContextEnabled();
    }

    protected displayThreadHistory(): void {
        this._overlayService.isThreadHistoryDisplayed.set(true);
    }

    protected displayHome(): void {
        this._messageFacade.dispatchClearMessages();

        this._threadFacade.dispatchChangeActiveThread(null);
    }

    protected handleWorkingContextPanelOpen(): void {
        this._overlayService.showPanelOverlay({
            title: UI_STRINGS.WORKING_CONTEXT_PANEL_COMPONENT.TITLE,
            content: WorkingContextPanelComponent,
            isHeaderCloseButtonDisplayed: true,
            footerButtons: [
                {
                    label: UI_STRINGS.GENERAL.CANCEL,
                    action: PANEL_BUTTON_ACTION_TYPE.CLOSE,
                    type: APP_BUTTON_TYPES.DEFAULT,
                    testId: "working-context-cancel-button",
                },
            ],
        });
    }
}
