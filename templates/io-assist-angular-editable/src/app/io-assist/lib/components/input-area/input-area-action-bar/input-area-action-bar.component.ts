import { CommonModule } from "@angular/common";
import { Component, inject, WritableSignal } from "@angular/core";

import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { AppSelectComponent } from "../../../shared/components/app-select/app-select.component";
import { APP_SELECT_IDS } from "../../../shared/components/app-select/app-select.service";
import { AppSelectOption } from "../../../shared/components/app-select/types";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { PERMISSION_MODE } from "../../../shared/enums/permission-mode.enum";
import { OverlayService } from "../../../shared/services/overlay/overlay.service";
import { PromptListComponent } from "../../prompt/prompt-list/prompt-list.component";
import { ToolListComponent } from "../../tool/tool-list/tool-list.component";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent, AppSelectComponent];

const PERMISSION_OPTIONS: AppSelectOption<PERMISSION_MODE>[] = [
    {
        title: "Ask permissions",
        miniTitle: "Ask",
        description: "Always ask for action permissions",
        isSelected: true,
        value: PERMISSION_MODE.ASK,
    },
    {
        title: "Auto accept permissions",
        miniTitle: "Auto",
        description: "Auto-approve all action permissions",
        value: PERMISSION_MODE.AUTO_ACCEPT,
    },
];

@Component({
    selector: "input-area-action-bar",
    imports: [...MODULES, ...COMPONENTS],
    templateUrl: "./input-area-action-bar.component.html",
})
export class InputAreaActionBarComponent {
    protected readonly UI_STRINGS = UI_STRINGS;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;
    protected readonly PERMISSION_OPTIONS = PERMISSION_OPTIONS;
    protected readonly APP_SELECT_IDS = APP_SELECT_IDS;

    private readonly _overlayService: OverlayService = inject(OverlayService);

    protected readonly isPromptPanelDisplayed: WritableSignal<boolean> = this._overlayService.isPromptPanelDisplayed;
    protected readonly isToolPanelDisplayed: WritableSignal<boolean> = this._overlayService.isToolPanelDisplayed;

    protected handlePromptPanelOverlayOpen(): void {
        this._overlayService.showPanelOverlay({
            title: UI_STRINGS.PROMPT_LIST_COMPONENT.AVAILABLE_PROMPTS,
            content: PromptListComponent,
            isHeaderCloseButtonDisplayed: true,
            isDisplayedSignal: this._overlayService.isPromptPanelDisplayed,
        });
    }

    protected handleToolPanelOverlayOpen(): void {
        this._overlayService.showPanelOverlay({
            title: UI_STRINGS.TOOL_LIST_COMPONENT.AVAILABLE_TOOLS,
            content: ToolListComponent,
            isHeaderCloseButtonDisplayed: true,
            isDisplayedSignal: this._overlayService.isToolPanelDisplayed,
        });
    }
}
