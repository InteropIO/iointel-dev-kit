import { Component, computed, DestroyRef, inject, input, InputSignal, linkedSignal, output, OutputEmitterRef, Signal, signal, WritableSignal } from "@angular/core";

import { AppIconComponent } from "../../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../../shared/components/app-icon/enum";
import { AppCodePanelComponent, AppCodePanelLanguage } from "../../../../shared/components/app-code-panel/app-code-panel.component";
import { AppTooltipComponent } from "../../../../shared/components/app-tooltip/app-tooltip.component";
import { TOOLTIP_DISPLAY_MODES, TOOLTIP_POSITIONS } from "../../../../shared/components/app-tooltip/enum";
import { UI_STRINGS } from "../../../../shared/constants/ui-strings";
import { CopyToClipboardService } from "../../../../shared/services/copy-to-clipboard/copy-to-clipboard.service";
import { formatDuration } from "../../../../shared/utils/tool-trace/tool-trace.format";
import { TraceStep } from "../../../../shared/utils/tool-trace/tool-trace.types";
import { TraceStatusIconComponent } from "../trace-status-icon/trace-status-icon.component";

type TraceTab = "explanation" | "input" | "code" | "output";

type TabContent = {
    text: string;
    /** Code tabs render in the code panel; the Explanation tab is plain prose. */
    language: AppCodePanelLanguage | "";
    label: string;
};

const COPIED_RESET_MS = 2000;

@Component({
    selector: "trace-step",
    templateUrl: "./trace-step.component.html",
    imports: [AppIconComponent, AppTooltipComponent, AppCodePanelComponent, TraceStatusIconComponent],
    providers: [CopyToClipboardService],
    host: {
        class: "block",
        "[attr.data-testid]": "'trace-step'",
    },
})
export class TraceStepComponent {
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;
    protected readonly UI_STRINGS = UI_STRINGS.TOOL_TRACE;
    protected readonly TOOLTIP_POSITIONS = TOOLTIP_POSITIONS;
    protected readonly TOOLTIP_DISPLAY_MODES = TOOLTIP_DISPLAY_MODES;

    // Same copy path as the chat's copy button: Clipboard API with a textarea fallback for
    // embedded (iframe) contexts like io.Connect, where the Clipboard API is often blocked.
    private readonly _copyToClipboardService: CopyToClipboardService = inject(CopyToClipboardService);

    public readonly step: InputSignal<TraceStep> = input.required<TraceStep>();
    public readonly isExpanded: InputSignal<boolean> = input<boolean>(false);
    public readonly onToggle: OutputEmitterRef<void> = output<void>();

    // Opens on Explanation for code mode (when there is one), otherwise on Output. Keyed on a
    // primitive so re-normalized steps (new objects on every store change) keep the chosen tab.
    private readonly _defaultTab: Signal<TraceTab> = computed<TraceTab>(() => (this.step().type === "code" && this.step().explanation ? "explanation" : "output"));
    protected readonly activeTab: WritableSignal<TraceTab> = linkedSignal<TraceTab>(() => this._defaultTab());
    protected readonly isCopied: WritableSignal<boolean> = signal<boolean>(false);
    // Drives the chevron's hover color from anywhere on the row, not just over the icon.
    protected readonly isRowHovered: WritableSignal<boolean> = signal<boolean>(false);
    protected readonly isCopyHovered: WritableSignal<boolean> = signal<boolean>(false);

    protected readonly domId: Signal<string> = computed<string>(() => `trace-step-${this.step().id.replace(/[^a-zA-Z0-9_-]/g, "")}`);
    protected readonly duration: Signal<string | undefined> = computed<string | undefined>(() => formatDuration(this.step().durationMs));

    protected readonly tabs: Signal<{ id: TraceTab; label: string }[]> = computed(() => {
        if (this.step().type !== "code") {
            return [
                { id: "input", label: this.UI_STRINGS.TAB_INPUT },
                { id: "output", label: this.UI_STRINGS.TAB_OUTPUT },
            ];
        }

        const codeTabs: { id: TraceTab; label: string }[] = [
            { id: "code", label: this.UI_STRINGS.TAB_CODE },
            { id: "output", label: this.UI_STRINGS.TAB_OUTPUT },
        ];

        return this.step().explanation ? [{ id: "explanation", label: this.UI_STRINGS.EXPLANATION_LABEL }, ...codeTabs] : codeTabs;
    });

    // The active tab's code, or undefined while the output is still running / empty.
    protected readonly content: Signal<TabContent | undefined> = computed<TabContent | undefined>(() => {
        const step = this.step();

        switch (this.activeTab()) {
            case "explanation":
                return step.explanation ? { text: step.explanation, language: "prose", label: this.UI_STRINGS.EXPLANATION_LABEL } : undefined;
            case "input":
                return { text: step.input ?? "{}", language: "json", label: this.UI_STRINGS.LANGUAGE_JSON };
            case "code":
                return step.code ? { text: step.code, language: "javascript", label: this.UI_STRINGS.LANGUAGE_JAVASCRIPT } : undefined;
            default: {
                const out = step.output;

                if (out.status === "running" || out.status === "empty") return undefined;

                return out.language === "json"
                    ? { text: out.text, language: "json", label: this.UI_STRINGS.LANGUAGE_JSON }
                    : { text: out.text, language: "text", label: this.UI_STRINGS.LANGUAGE_TEXT };
            }
        }
    });

    // Whether the step itself failed - drives the red "(Failed)" label next to the title,
    // independent of which tab is active.
    protected readonly isStepError: Signal<boolean> = computed<boolean>(() => this.step().status === "error");

    // Flattens the panel's render states into one value so the template can @switch over it
    // instead of nesting @if blocks.
    protected readonly panelView: Signal<"prose" | "code" | "running" | "empty"> = computed(() => {
        const tabContent = this.content();

        if (tabContent) return tabContent.language === "prose" ? "prose" : "code";
        if (this.activeTab() === "output" && this.step().output.status === "running") return "running";

        return "empty";
    });

    protected readonly copyLabel: Signal<string> = computed<string>(() => {
        switch (this.activeTab()) {
            case "explanation":
                return this.UI_STRINGS.COPY_EXPLANATION;
            case "input":
                return this.UI_STRINGS.COPY_INPUT;
            case "code":
                return this.UI_STRINGS.COPY_CODE;
            default:
                return this.UI_STRINGS.COPY_OUTPUT;
        }
    });

    private _copiedTimeoutId?: ReturnType<typeof setTimeout>;

    constructor() {
        inject(DestroyRef).onDestroy(() => clearTimeout(this._copiedTimeoutId));
    }

    protected toggle(): void {
        this.onToggle.emit();
    }

    protected selectTab(tab: TraceTab): void {
        this.activeTab.set(tab);
    }

    // Arrow / Home / End move between tabs (roving tabindex, WAI-ARIA tabs pattern).
    protected handleTabKeydown(event: KeyboardEvent): void {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

        event.preventDefault();

        const ids: TraceTab[] = this.tabs().map((tab) => tab.id);
        const current = ids.indexOf(this.activeTab());
        let next = current;

        if (event.key === "ArrowRight") next = (current + 1) % ids.length;
        if (event.key === "ArrowLeft") next = (current - 1 + ids.length) % ids.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = ids.length - 1;

        this.activeTab.set(ids[next]);

        const tablist = (event.currentTarget as HTMLElement).closest('[role="tablist"]');

        tablist?.querySelector<HTMLElement>(`[data-tab="${ids[next]}"]`)?.focus();
    }

    protected async copy(): Promise<void> {
        const text = this.content()?.text;

        if (!text) return;

        try {
            await this._copyToClipboardService.copyToClipboard(text);
        } catch {
            // No clipboard at all - nothing to copy to, so don't claim it was copied.
            return;
        }

        this.isCopied.set(true);
        clearTimeout(this._copiedTimeoutId);
        this._copiedTimeoutId = setTimeout(() => this.isCopied.set(false), COPIED_RESET_MS);
    }
}
