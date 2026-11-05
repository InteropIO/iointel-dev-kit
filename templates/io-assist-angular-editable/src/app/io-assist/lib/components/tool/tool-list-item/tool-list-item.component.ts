import { CommonModule } from "@angular/common";
import { Component, computed, effect, ElementRef, inject, input, InputSignal, output, OutputEmitterRef, signal, Signal, WritableSignal } from "@angular/core";

import { ToolDetailsComponent } from "./tool-details/tool-details.component";
import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { APP_SPINNER_COMPONENT_SIZE } from "../../../shared/components/app-spinner/enum";
import { AppToggleComponent } from "../../../shared/components/app-toggle/app-toggle.component";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { USER_TOOL_STATE } from "../../../shared/store/tool/enums";
import { ToolFacade } from "../../../shared/store/tool/tool.facade";
import { UITool } from "../../../shared/store/tool/types";

const COMPONENTS = [AppToggleComponent, AppIconComponent, ToolDetailsComponent];
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
    // Only one row's details are open at a time — the list owns which one.
    public readonly isDetailsOpen: InputSignal<boolean> = input<boolean>(false);
    public readonly onToggleDetails: OutputEmitterRef<void> = output<void>();

    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;
    protected readonly UI_STRINGS = UI_STRINGS.TOOL_LIST_ITEM_COMPONENT;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;

    private readonly _toolFacade: ToolFacade = inject(ToolFacade);
    private readonly _hostRef: ElementRef<HTMLElement> = inject(ElementRef);
    private readonly _enabledTools: Signal<UITool[]> = this._toolFacade.enabledTools;

    protected isHovered: WritableSignal<boolean> = signal<boolean>(false);

    protected readonly isEnabled: Signal<boolean> = computed<boolean>(() => this._enabledTools().includes(this.tool()));
    protected readonly isOperationPending: Signal<boolean> = computed<boolean>(() => this.tool().state !== USER_TOOL_STATE.IDLE);

    protected readonly detailsId: Signal<string> = computed<string>(() => `tool-details-${this.tool().name.replace(/[^a-zA-Z0-9_-]/g, "")}`);

    constructor() {
        // Keep newly opened details visible inside the scrolling list.
        effect(() => {
            if (this.isDetailsOpen()) {
                requestAnimationFrame(() => this._hostRef.nativeElement.scrollIntoView({ block: "nearest", behavior: "smooth" }));
            }
        });
    }

    protected handleDetailsToggle(event: Event): void {
        event.stopPropagation();
        this.onToggleDetails.emit();
    }

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
