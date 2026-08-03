import { CommonModule } from "@angular/common";
import { Component, computed, inject, input, InputSignal, Signal } from "@angular/core";

import { AppButtonComponent } from "../../../shared/components/app-button/app-button.component";
import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { AccentGradientBorderDirective } from "../../../shared/directives/accent-gradient-border/accent-gradient-border.directive";
import { MessageFacade } from "../../../shared/store/message/message.facade";
import { ToolTraceState } from "../../../shared/store/message/types";
import { MessageFooterComponent } from "../message-footer/message-footer.component";
import { ToolMessageComponent } from "../tool-message/tool-message.component";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent, ToolMessageComponent, AppButtonComponent, MessageFooterComponent];
const DIRECTIVES = [AccentGradientBorderDirective];

@Component({
    selector: "tool-trace-message",
    templateUrl: "./tool-trace-message.component.html",
    imports: [...MODULES, ...COMPONENTS, ...DIRECTIVES],
    host: { "data-testid": "tool-trace-host" },
})
export class ToolTraceMessageComponent {
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly UI_STRINGS = UI_STRINGS.TOOL_TRACE_MESSAGE_COMPONENT;

    public readonly parentMessage: InputSignal<string> = input.required<string>();

    private readonly _messageFacade: MessageFacade = inject(MessageFacade);

    private readonly _toolTraceState: Signal<ToolTraceState[]> = this._messageFacade.toolTraceState;
    protected readonly currentToolTraceState: Signal<ToolTraceState | undefined> = computed<ToolTraceState | undefined>(() => {
        return this._toolTraceState().find((state: ToolTraceState) => state.stateForMessageId === this.parentMessage());
    });

    protected readonly shouldDisplayFooter: Signal<boolean> = computed<boolean>(() => {
        return this.currentToolTraceState()?.displayFooter ?? false;
    });

    protected readonly responseForUserQueryId: Signal<string | undefined> = computed<string | undefined>(() => this.currentToolTraceState()?.responseForUserQueryId);

    protected toggleExpanded(): void {
        this._messageFacade.dispatchToggleToolTrace(this.parentMessage());
    }
}
