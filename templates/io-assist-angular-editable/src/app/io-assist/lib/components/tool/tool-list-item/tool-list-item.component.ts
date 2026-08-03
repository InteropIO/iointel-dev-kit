import { CommonModule } from "@angular/common";
import { Component, computed, inject, input, InputSignal, signal, Signal, WritableSignal } from "@angular/core";

import { ToolInfoComponent } from "./tool-info/tool-info.component";
import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { APP_SPINNER_COMPONENT_SIZE } from "../../../shared/components/app-spinner/enum";
import { AppToggleComponent } from "../../../shared/components/app-toggle/app-toggle.component";
import { AppTooltipComponent } from "../../../shared/components/app-tooltip/app-tooltip.component";
import { TOOLTIP_POSITIONS } from "../../../shared/components/app-tooltip/enum";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { USER_TOOL_STATE } from "../../../shared/store/tool/enums";
import { ToolFacade } from "../../../shared/store/tool/tool.facade";
import { UITool } from "../../../shared/store/tool/types";

const COMPONENTS = [AppToggleComponent, AppIconComponent, AppTooltipComponent, ToolInfoComponent];
const MODULES = [CommonModule];

@Component({
    selector: "tool-list-item",
    templateUrl: "./tool-list-item.component.html",
    imports: [...COMPONENTS, ...MODULES],
    host: {
        "(mouseenter)": "handleMouseEnter()",
        "(mouseleave)": "handleMouseLeave()",
    },
})
export class ToolListItemComponent {
    public readonly tool: InputSignal<UITool> = input.required<UITool>();

    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;
    protected readonly UI_STRINGS = UI_STRINGS.TOOL_LIST_ITEM_COMPONENT;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;
    protected readonly TOOLTIP_POSITIONS = TOOLTIP_POSITIONS;

    private readonly _toolFacade: ToolFacade = inject(ToolFacade);
    private readonly _enabledTools: Signal<UITool[]> = this._toolFacade.enabledTools;

    protected isHovered: WritableSignal<boolean> = signal<boolean>(false);

    protected readonly isEnabled: Signal<boolean> = computed<boolean>(() => this._enabledTools().includes(this.tool()));
    protected readonly isOperationPending: Signal<boolean> = computed<boolean>(() => this.tool().state !== USER_TOOL_STATE.IDLE);

    protected handleToolToggle(tool: UITool): void {
        return this._toolFacade.dispatchToggleTool(tool);
    }

    protected handleMouseEnter(): void {
        this.isHovered.set(true);
    }

    protected handleMouseLeave(): void {
        this.isHovered.set(false);
    }
}
