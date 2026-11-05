import React from "react";

import { MessageFooter } from "./MessageFooter";
import { ToolMessage } from "./ToolMessage";
import { UI_STRINGS } from "../../constants/uiStrings";
import type { ToolTraceState, UIToolMessage } from "../../types";
import { normalizeStep, summarizeTrace } from "../../utils/toolTrace";
import { ChevronDownLightIcon } from "../shared/icons";

type ToolTraceProps = {
    trace: ToolTraceState;
    onToggle: (messageId: string) => void;
    onToggleTool: (toolId: string, parentId: string) => void;
    // Set when this trace is the tail of its response (e.g. a response that ended
    // in a tool call): the footer renders inside the trace, like ng.
    showFooter?: boolean;
    footerCopyText?: string;
    onReload?: () => void;
    isGenerating?: boolean;
    // True only for the trace at the tail of the whole toolTraceState array — mirrors ng's
    // `_isLatestTrace`: only that one can still legitimately be receiving tool calls, so an
    // earlier, already-superseded trace never resurrects the "Working" shimmer just because a
    // later trace in the same response is still streaming.
    isLatestTrace?: boolean;
};

export const ToolTraceMessage: React.FC<ToolTraceProps> = ({
    trace,
    onToggle,
    onToggleTool,
    showFooter = false,
    footerCopyText = "",
    onReload,
    isGenerating = false,
    isLatestTrace = false,
}) => {
    const executedTools = trace.executedTools;
    const isExpanded = !!trace.isExpanded;
    const hasTools = executedTools.length > 0;

    // Only THIS trace's own tools being incomplete matters - see isLatestTrace above.
    const isThisTraceGenerating = isGenerating && isLatestTrace;
    const isFinished = !isThisTraceGenerating;

    const steps = executedTools.map((tool: UIToolMessage) => normalizeStep(tool, { isFinished }));
    const summary = summarizeTrace(steps);
    const isSlow = summary.phase === "working" && !isExpanded;
    const isComplete = summary.phase !== "working";

    const handleToggle = (): void => {
        if (!hasTools) return;
        onToggle(trace.stateForMessageId);
    };

    const handleHeaderKeyUp = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (event.key !== "Enter" && event.key !== " ") return;
        handleToggle();
    };

    return (
        <>
            <div
                data-testid="tool-trace-message"
                id={`tool-trace-message-${trace.stateForMessageId}`}
                className={["tool-trace-message relative flex flex-col gap-2 text-text-default pt-4", !isExpanded ? "rounded-[8px]" : ""].filter(Boolean).join(" ")}
            >
                <div className={["tool-trace-message__content relative flex flex-col", isExpanded ? "items-start w-full" : "gap-2"].join(" ")}>
                    <div
                        data-testid="tool-trace-header"
                        tabIndex={0}
                        role="button"
                        aria-expanded={hasTools ? isExpanded : undefined}
                        className={["group tool-trace-message__header flex items-center", hasTools ? "cursor-pointer" : "cursor-default"].join(" ")}
                        onClick={handleToggle}
                        onKeyUp={handleHeaderKeyUp}
                    >
                        {isSlow && (
                            <span className="tool-trace-message__breathing-dots" data-testid="tool-trace-breathing-dots">
                                <span className="tool-trace-message__dot" />
                                <span className="tool-trace-message__dot" />
                                <span className="tool-trace-message__dot" />
                            </span>
                        )}

                        <span
                            data-testid="tool-trace-title"
                            className={[
                                "tool-trace-message__title",
                                isSlow ? "tool-trace-message__title--shimmer" : isComplete ? "text-text-secondary group-hover:text-text-states-active" : "group-hover:text-text-states-active",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
                            {summary.parts.map((part, index) => (
                                <React.Fragment key={index}>
                                    <span data-testid={index === summary.failedPartIndex ? "tool-trace-title-failed-part" : undefined} className={index === summary.failedPartIndex ? "text-status-error" : undefined}>
                                        {part}
                                    </span>
                                    {index < summary.parts.length - 1 && <span className="tool-trace-message__title-separator" aria-hidden="true" />}
                                </React.Fragment>
                            ))}
                        </span>

                        {hasTools && (
                            // ng's app-icon defaults to `isWrapped=true` at size XS (12px), which doubles the
                            // host element to 24px (6px of padding around the glyph on every side). Ported here
                            // as an outer 24x24 flex-centered box wrapping the 12x12 icon itself.
                            <span
                                data-testid="tool-trace-expand-icon"
                                className={["inline-flex size-6 shrink-0 items-center justify-center", !isExpanded ? "opacity-0 group-hover:opacity-100" : ""].filter(Boolean).join(" ")}
                                title={isExpanded ? UI_STRINGS.TOOL_TRACE_MESSAGE.COLLAPSE_BUTTON_TEXT : UI_STRINGS.TOOL_TRACE_MESSAGE.EXPAND_BUTTON_TEXT}
                            >
                                <span
                                    className={[
                                        "tool-trace-message__expand-icon inline-flex w-3 h-3 text-icon-default group-hover:text-icon-hover",
                                        isExpanded ? "tool-trace-message__expand-icon--rotated" : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    <ChevronDownLightIcon />
                                </span>
                            </span>
                        )}
                    </div>

                    {isExpanded && hasTools && (
                        <div data-testid="tool-trace-body" className="tool-trace-message__card">
                            {executedTools.map((tool) => (
                                <ToolMessage key={tool.id} tool={tool} parentToolTraceId={trace.stateForMessageId} onToggle={onToggleTool} isFinished={isFinished} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showFooter && <MessageFooter copyText={footerCopyText} onReload={onReload} isGenerating={isGenerating} />}
        </>
    );
};

