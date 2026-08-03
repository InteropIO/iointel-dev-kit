import React from "react";

import { MessageFooter } from "./MessageFooter";
import { ToolMessage } from "./ToolMessage";
import { UI_STRINGS } from "../../constants/uiStrings";
import type { ToolTraceState } from "../../types";
import { ChevronDownIcon, ChevronRightIcon } from "../shared/icons";

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
};

const GRADIENT_MASK = "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)";

export const ToolTraceMessage: React.FC<ToolTraceProps> = ({ trace, onToggle, onToggleTool, showFooter = false, footerCopyText = "", onReload, isGenerating = false }) => {
    const uiMessage = trace.uiMessage || "No UI Message";
    const executedTools = trace.executedTools;
    const isExpanded = !!trace.isExpanded;
    const hasTools = executedTools.length > 0;

    const handleToggle = (): void => {
        if (!hasTools) return;
        onToggle(trace.stateForMessageId);
    };

    return (
        <div
            data-testid="tool-trace-message"
            id={`tool-trace-message-${trace.stateForMessageId}`}
            className="tool-trace-message relative flex flex-col flex-1 gap-2 text-text-default rounded-[8px] isolate"
        >
            {isExpanded && (
                <>
                    {/* Solid background sits behind the gradient ring so the mask cutout reveals it. */}
                    <div aria-hidden className="absolute inset-0 z-[-2] rounded-[8px] pointer-events-none bg-app-background" />
                    <div
                        aria-hidden
                        className="absolute inset-0 z-[-1] p-px rounded-[8px] pointer-events-none bg-[linear-gradient(90deg,var(--app-accent-color-1),var(--app-accent-color-2))]"
                        style={{
                            mask: GRADIENT_MASK,
                            WebkitMask: GRADIENT_MASK,
                            maskComposite: "exclude",
                            WebkitMaskComposite: "xor",
                        }}
                    />
                </>
            )}

            <div className="relative flex flex-col gap-2 px-4 py-6">
                <button
                    type="button"
                    data-testid="tool-trace-header"
                    tabIndex={0}
                    className={[
                        "tool-trace-message__header flex items-center gap-2 text-left transition-colors hover:text-text-states-active",
                        hasTools ? "cursor-pointer" : "cursor-default",
                        isExpanded ? "flex-row-reverse justify-end" : "",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                    onClick={handleToggle}
                >
                    <span data-testid="tool-trace-title" className="text-[13px] leading-[19px]">
                        {uiMessage}
                    </span>

                    {hasTools && (
                        <span
                            data-testid="tool-trace-expand-icon"
                            className={["w-3 h-3 shrink-0 inline-flex items-center justify-center", isExpanded ? "text-app-accent-color-1" : "text-text-default"].join(" ")}
                            title={isExpanded ? UI_STRINGS.TOOL_TRACE_MESSAGE.COLLAPSE_BUTTON_TEXT : UI_STRINGS.TOOL_TRACE_MESSAGE.EXPAND_BUTTON_TEXT}
                        >
                            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                        </span>
                    )}
                </button>

                {isExpanded && hasTools && (
                    <>
                        <div data-testid="tool-trace-body" className="tool-trace-message__body flex flex-col">
                            {executedTools.map((tool) => (
                                <ToolMessage key={tool.id} tool={tool} parentToolTraceId={trace.stateForMessageId} onToggle={onToggleTool} />
                            ))}
                        </div>

                        <div className="flex">
                            <button
                                type="button"
                                data-testid="tool-trace-close-button"
                                className="flex justify-center items-center gap-1 px-3 py-1.5 rounded-sm text-sm text-text-default border border-border-default cursor-pointer transition-colors hover:text-text-states-active hover:border-border-hover"
                                onClick={handleToggle}
                            >
                                {UI_STRINGS.TOOL_TRACE_MESSAGE.CLOSE_BUTTON_TEXT}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {showFooter && (
                <div className="relative px-4 pb-4">
                    <MessageFooter copyText={footerCopyText} onReload={onReload} isGenerating={isGenerating} />
                </div>
            )}
        </div>
    );
};
