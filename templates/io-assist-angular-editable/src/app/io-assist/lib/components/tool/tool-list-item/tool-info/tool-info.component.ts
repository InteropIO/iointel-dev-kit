import { CommonModule } from "@angular/common";
import { Component, input, InputSignal } from "@angular/core";

import { UI_STRINGS } from "../../../../shared/constants/ui-strings";
import { UITool } from "../../../../shared/store/tool/types";

@Component({
    selector: "tool-info",
    templateUrl: "./tool-info.component.html",
    imports: [CommonModule],
})
export class ToolInfoComponent {
    protected readonly UI_STRINGS = UI_STRINGS.TOOL_INFO;

    public readonly tool: InputSignal<UITool> = input.required<UITool>();
}
