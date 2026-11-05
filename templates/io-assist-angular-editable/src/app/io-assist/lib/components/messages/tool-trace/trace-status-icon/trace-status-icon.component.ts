import { Component, computed, input, InputSignal, Signal } from "@angular/core";

import { AppIconComponent } from "../../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../../shared/components/app-icon/enum";
import { UI_STRINGS } from "../../../../shared/constants/ui-strings";
import { StepStatus } from "../../../../shared/utils/tool-trace/tool-trace.types";

const HOST_BASE_CLASS = "inline-flex shrink-0 items-center justify-center size-4 rounded-full";

const HOST_STATUS_CLASSES: Partial<Record<StepStatus, string>> = {
    success: "bg-[color-mix(in_srgb,var(--app-status-active)_18%,transparent)]",
    error: "bg-[color-mix(in_srgb,var(--app-status-error)_18%,transparent)]",
};

@Component({
    selector: "trace-status-icon",
    templateUrl: "./trace-status-icon.component.html",
    imports: [AppIconComponent],
    host: {
        role: "img",
        "[attr.aria-label]": "label()",
        "[class]": "hostClass()",
    },
})
export class TraceStatusIconComponent {
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;

    public readonly status: InputSignal<StepStatus> = input.required<StepStatus>();

    protected readonly label: Signal<string> = computed<string>(() => UI_STRINGS.TOOL_TRACE.STATUS_LABELS[this.status()]);

    protected readonly hostClass: Signal<string> = computed<string>(() => `${HOST_BASE_CLASS} ${HOST_STATUS_CLASSES[this.status()] ?? ""}`.trim());
}
