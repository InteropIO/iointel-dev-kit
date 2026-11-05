import { CommonModule } from "@angular/common";
import { Component, computed, effect, inject, input, InputSignal, signal, Signal, WritableSignal } from "@angular/core";

import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { MessageFacade } from "../../../shared/store/message/message.facade";
import { ToolTraceState, UIToolMessage } from "../../../shared/store/message/types";
import { ToolFacade } from "../../../shared/store/tool/tool.facade";
import { UITool } from "../../../shared/store/tool/types";
import { normalizeStep, summarizeTrace, ToolDefinitionInfo } from "../../../shared/utils/tool-trace/tool-trace.normalizer";
import { TraceStep, TraceSummary } from "../../../shared/utils/tool-trace/tool-trace.types";
import { MessageFooterComponent } from "../message-footer/message-footer.component";
import { TraceStepComponent } from "../tool-trace/trace-step/trace-step.component";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent, TraceStepComponent, MessageFooterComponent];

// Tool definitions (titles/descriptions) normally load when the Tools panel opens - request
// them once, the first time any trace is expanded without them.
let hasRequestedToolDefinitions = false;

@Component({
    selector: "tool-trace-message",
    templateUrl: "./tool-trace-message.component.html",
    styleUrls: ["./tool-trace-message.component.css"],
    imports: [...MODULES, ...COMPONENTS],
    providers: [ToolFacade],
    host: {
        "data-testid": "tool-trace-host",
    },
})
export class ToolTraceMessageComponent {
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly UI_STRINGS = UI_STRINGS.TOOL_TRACE_MESSAGE_COMPONENT;

    public readonly parentMessage: InputSignal<string> = input.required<string>();

    // Tracked via (mouseenter)/(mouseleave) bound directly on the header element in the
    // template (not the component host, and not CSS :hover). Two reasons:
    // 1. The header is now a single persistent element shared by both the expanded and
    //    collapsed states (only its content/classes change), so it's never destroyed and
    //    recreated when toggling - which is what previously made CSS :hover (and, later, a
    //    host-level listener bound to a duplicated header-per-branch template) prone to a
    //    "flash" of the default color right after a click, since browsers don't reliably
    //    re-run :hover hit-testing against a stationary cursor after a layout shift.
    // 2. Binding on the header specifically - rather than the whole component host - means
    //    this only reacts to the cursor being over THIS trace's own header. The host also
    //    contains the sibling body with the step cards when expanded; a host-level listener
    //    would treat hovering any of those as hovering this trace too, since
    //    mouseenter/mouseleave fire based on entering/leaving the whole element's bounding
    //    box, not just the specific descendant under the cursor.
    protected readonly isHovered: WritableSignal<boolean> = signal<boolean>(false);

    private readonly _messageFacade: MessageFacade = inject(MessageFacade);
    private readonly _toolFacade: ToolFacade = inject(ToolFacade);

    private readonly _toolTraceState: Signal<ToolTraceState[]> = this._messageFacade.toolTraceState;
    protected readonly currentToolTraceState: Signal<ToolTraceState | undefined> = computed<ToolTraceState | undefined>(() => {
        return this._toolTraceState().find((state: ToolTraceState) => state.stateForMessageId === this.parentMessage());
    });

    // isGeneratingResponse() is a single app-wide flag - it goes back to true as soon as ANY
    // new trace starts streaming, which would otherwise resurrect the "running" animation on
    // an older, already-superseded trace that has a straggler tool call which never got a
    // result (e.g. an abandoned attempt before a "let me retry that search" follow-up).
    // New trace entries are always appended (see addToolTraceCallEntry), so only the trace at
    // the tail of the array can legitimately still be receiving tool calls - every earlier
    // trace is done by construction, regardless of its own tools' result state.
    private readonly _isLatestTrace: Signal<boolean> = computed<boolean>(() => {
        const traces: ToolTraceState[] = this._toolTraceState();

        return traces.length > 0 && traces[traces.length - 1].stateForMessageId === this.parentMessage();
    });

    private readonly _isThisTraceGenerating: Signal<boolean> = computed<boolean>(() => this._messageFacade.isGeneratingResponse() && this._isLatestTrace());

    protected readonly shouldDisplayFooter: Signal<boolean> = computed<boolean>(() => {
        return this.currentToolTraceState()?.displayFooter ?? false;
    });

    protected readonly responseForUserQueryId: Signal<string | undefined> = computed<string | undefined>(() => this.currentToolTraceState()?.responseForUserQueryId);

    private readonly _toolDefinitions: Signal<Map<string, ToolDefinitionInfo>> = computed<Map<string, ToolDefinitionInfo>>(
        () => new Map(this._toolFacade.allTools().map((tool: UITool) => [tool.name, { title: tool.title }]))
    );

    // Every tool call normalized into the one shape the trace UI renders. A step still
    // without a result once this trace is no longer generating is reported as failed.
    protected readonly steps: Signal<TraceStep[]> = computed<TraceStep[]>(() => {
        const definitions = this._toolDefinitions();
        const context = { isFinished: !this._isThisTraceGenerating(), getToolDefinition: (name: string) => definitions.get(name) };

        return (this.currentToolTraceState()?.executedTools ?? []).map((tool: UIToolMessage) => normalizeStep(tool, context));
    });

    // "Working - Using N tools" / "Failed - Used N tools" / "Done - Used N tools".
    protected readonly summary: Signal<TraceSummary> = computed<TraceSummary>(() => summarizeTrace(this.steps()));

    protected readonly headerPhaseParts: Signal<string[]> = computed<string[]>(() => this.summary().parts);

    // True once every tool in THIS trace has a result (or the response has otherwise
    // finished) - drives the default (non-hover) "complete" text color, independent of
    // whether the animation delay has kicked in.
    protected readonly isComplete: Signal<boolean> = computed<boolean>(() => this.summary().phase !== "working");

    // THIS trace still has a tool without a result, the pill is collapsed, AND the response
    // is still actually generating - the candidate window for showing a "still working"
    // indicator. The isGeneratingResponse() check is a safety net, not the primary gate: an
    // earlier-finished trace still won't animate just because a later trace in the same
    // response is running, since it independently requires ITS OWN tools to be incomplete.
    private readonly _isRunningCollapsed: Signal<boolean> = computed<boolean>(() => {
        return this.summary().phase === "working" && !(this.currentToolTraceState()?.isExpanded ?? false);
    });

    // Shows the breathing dots / shimmer immediately whenever the trace is running and
    // collapsed - no minimum-duration delay.
    protected readonly isSlow: Signal<boolean> = this._isRunningCollapsed;

    // True for a brief grace period right after the trace completes (isRunningCollapsed
    // flips back to false) while the animation WAS showing - keeps the dots mounted just
    // long enough to play a fade-out transition instead of vanishing the instant the tool
    // finishes.
    private readonly _isFadingOut: WritableSignal<boolean> = signal<boolean>(false);
    protected readonly isFadingOut: Signal<boolean> = this._isFadingOut.asReadonly();

    private _wasRunningCollapsed = false;
    private _fadeOutTimeoutId?: ReturnType<typeof setTimeout>;

    constructor() {
        effect(() => {
            const runningCollapsed = this._isRunningCollapsed();

            if (runningCollapsed) {
                clearTimeout(this._fadeOutTimeoutId);
                this._fadeOutTimeoutId = undefined;
                this._isFadingOut.set(false);
            } else if (this._wasRunningCollapsed) {
                this._isFadingOut.set(true);
                this._fadeOutTimeoutId ??= setTimeout(() => {
                    this._isFadingOut.set(false);
                    this._fadeOutTimeoutId = undefined;
                }, 250);
            }

            this._wasRunningCollapsed = runningCollapsed;
        });

        effect(() => {
            if (!hasRequestedToolDefinitions && this.currentToolTraceState()?.isExpanded && this._toolFacade.allTools().length === 0 && !this._toolFacade.isFetchingTools()) {
                hasRequestedToolDefinitions = true;
                this._toolFacade.dispatchFetchTools();
            }
        });
    }

    protected toggleStep(stepId: string): void {
        this._messageFacade.dispatchToggleToolMessage(stepId, this.parentMessage());
    }

    protected isStepExpanded(stepId: string): boolean {
        return this.currentToolTraceState()?.executedTools.find((tool: UIToolMessage) => tool.id === stepId)?.isExpanded ?? false;
    }

    protected toggleExpanded(): void {
        this._messageFacade.dispatchToggleToolTrace(this.parentMessage());
    }
}

