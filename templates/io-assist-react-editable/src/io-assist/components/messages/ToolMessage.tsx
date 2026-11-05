import React, { useMemo, useState } from "react";

import { UI_STRINGS } from "../../constants/uiStrings";
import { TOOL_RESULT_TYPES, type ToolResult, type UIToolMessage } from "../../types/message";
import { formatDuration, normalizeStep, NO_RESULT_TEXT } from "../../utils/toolTrace";
import { CodePanel } from "../shared/CodePanel";
import { CopyButton } from "../shared/CopyButton";
import { ChevronDownLightIcon, CodeLightIcon, ToolPanelIcon } from "../shared/icons";

type Props = {
    tool: UIToolMessage;
    parentToolTraceId: string;
    onToggle: (toolId: string, parentId: string) => void;
    isFinished: boolean;
};

type TraceTab = "explanation" | "input" | "code" | "output";

const getTabLabel = (tab: TraceTab): string => {
    switch (tab) {
        case "explanation":
            return UI_STRINGS.TOOL_MESSAGE.EXPLANATION_LABEL;
        case "code":
            return UI_STRINGS.TOOL_MESSAGE.TAB_CODE;
        case "input":
            return UI_STRINGS.TOOL_MESSAGE.TAB_INPUT;
        default:
            return UI_STRINGS.TOOL_MESSAGE.TAB_OUTPUT;
    }
};

// Label shown next to the copy button for the active tab's content - mirrors ng's
// `tabContent.label` (JSON / JavaScript / Plain text depending on the tab).
const getLanguageLabel = (tab: TraceTab): string => {
    switch (tab) {
        case "explanation":
            return UI_STRINGS.TOOL_MESSAGE.LANGUAGE_PLAIN_TEXT;
        case "code":
            return UI_STRINGS.TOOL_MESSAGE.LANGUAGE_JAVASCRIPT;
        default:
            return UI_STRINGS.TOOL_MESSAGE.LANGUAGE_JSON;
    }
};

const parseTextResult = (result: ToolResult): unknown => {
    if (result.type !== TOOL_RESULT_TYPES.TEXT) return result;
    try {
        return { type: result.type, text: JSON.parse(result.text) };
    } catch {
        return { type: result.type, text: result.text };
    }
};

const resultToJSONText = (result: NonNullable<UIToolMessage["result"]>): string => {
    if (!Array.isArray(result)) return JSON.stringify(parseTextResult(result), null, 2);
    return result.map((r) => JSON.stringify(parseTextResult(r), null, 2)).join("\n\n---\n\n");
};

export const ToolMessage: React.FC<Props> = ({ tool, parentToolTraceId, onToggle, isFinished }) => {
    const isExpanded = !!tool.isExpanded;

    const step = useMemo(() => normalizeStep(tool, { isFinished }), [tool, isFinished]);
    const isCode = step.type === "code";
    const isStepError = step.status === "error";
    const isRunning = step.status === "running";
    const isEmpty = step.status === "empty";
    const duration = formatDuration(step.durationMs);

    // executeCode steps get an exclusive Explanation (optional) / Code / Output tab set instead
    // of the regular tool's Input / Output - ports ng's `tabs()` computed signal.
    const tabs = useMemo<TraceTab[]>(() => {
        if (!isCode) return ["input", "output"];
        return step.explanation ? ["explanation", "code", "output"] : ["code", "output"];
    }, [isCode, step.explanation]);

    // Opens on Explanation for code steps that have one, otherwise on Output - ports ng's
    // `_defaultTab` computed signal.
    const [activeTab, setActiveTab] = useState<TraceTab>(() => (isCode && step.explanation ? "explanation" : "output"));

    const argsText = useMemo(() => JSON.stringify(tool.args ?? {}, null, 2), [tool.args]);
    const resultText = useMemo(() => (tool.result === undefined || tool.result === null ? undefined : resultToJSONText(tool.result)), [tool.result]);

    const activeContent =
        activeTab === "explanation" ? step.explanation : activeTab === "code" ? step.code : activeTab === "input" ? argsText : !isRunning && !isEmpty ? resultText : undefined;

    // Arrow / Home / End move between tabs (roving tabindex, WAI-ARIA tabs pattern) - ports
    // ng's trace-step.component.ts `handleTabKeydown` so Tab/Shift+Tab don't skip Input entirely.
    const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

        event.preventDefault();

        const current = tabs.indexOf(activeTab);
        let next = current;

        if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
        if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;

        const nextTab = tabs[next];
        setActiveTab(nextTab);

        const tablist = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
        tablist?.querySelector<HTMLElement>(`[data-tab="${nextTab}"]`)?.focus();
    };

    return (
        <div data-testid="trace-step" className="block">
            <button
                type="button"
                data-testid="trace-step-row"
                aria-expanded={isExpanded}
                className={[
                    "group flex w-full min-h-9 items-center gap-2.5 border-none bg-transparent px-3.5 text-left text-text-default cursor-pointer hover:bg-trace-row-expanded-background",
                    isExpanded ? "bg-trace-row-expanded-background text-text-states-active" : "",
                ].join(" ")}
                onClick={() => onToggle(tool.id, parentToolTraceId)}
            >
                <span className="inline-flex w-4 shrink-0 items-center justify-center text-text-secondary" aria-hidden="true">
                    <span className="w-3 h-3 inline-flex">{isCode ? <CodeLightIcon /> : <ToolPanelIcon />}</span>
                </span>

                <span className="flex-[0_1_auto] min-w-0 truncate text-[13px] leading-[18px]" data-testid="trace-step-title">
                    {step.title}
                    {isStepError && (
                        <span className="ml-1 text-status-error" data-testid="trace-step-failed-label">
                            ({UI_STRINGS.TOOL_MESSAGE.STATUS_LABELS.error})
                        </span>
                    )}
                </span>

                <span className="flex-1" />

                {duration && <span className="shrink-0 text-xs text-text-secondary tabular-nums">{duration}</span>}

                {isRunning && (
                    <span
                        role="img"
                        aria-label={UI_STRINGS.TOOL_MESSAGE.STATUS_LABELS.running}
                        className="inline-flex shrink-0 items-center justify-center size-4"
                    >
                        <span className="block box-border size-3 rounded-full border-[1.5px] border-trace-skeleton border-t-[color:var(--app-blue,#4a8cff)] animate-spin motion-reduce:[animation-duration:2.4s]" />
                    </span>
                )}

                <span className="inline-flex size-6 shrink-0 -mr-1 items-center justify-center rounded-md transition-colors duration-150 motion-reduce:transition-none group-hover:bg-icon-button-hover" aria-hidden="true">
                    <span
                        className={[
                            "inline-flex w-3 h-3 transition-transform duration-150 motion-reduce:transition-none text-icon-default group-hover:text-icon-hover",
                            isExpanded ? "rotate-180" : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        <ChevronDownLightIcon />
                    </span>
                </span>
            </button>

            {isExpanded && (
                <div data-testid="trace-step-body" className="flex flex-col border-t border-border-default bg-trace-body-background">
                    <div className="flex h-9 items-center justify-between gap-2 pt-1 pr-2 pb-0 pl-[7px]">
                        <div className="flex items-center gap-0.5" role="tablist" aria-label={UI_STRINGS.TOOL_MESSAGE.TABS_LABEL}>
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    role="tab"
                                    data-tab={tab}
                                    aria-selected={activeTab === tab}
                                    tabIndex={activeTab === tab ? 0 : -1}
                                    className="rounded-md border-none bg-transparent px-[9px] py-[3px] text-xs leading-4 text-trace-label cursor-pointer hover:bg-icon-button-hover hover:text-text-states-active aria-selected:bg-icon-button-selected aria-selected:text-text-states-active"
                                    onClick={() => setActiveTab(tab)}
                                    onKeyDown={handleTabKeyDown}
                                >
                                    {getTabLabel(tab)}
                                </button>
                            ))}
                        </div>

                        {activeContent && (
                            <div className="flex shrink-0 items-center gap-1.5">
                                <span className="text-[11px] leading-4 tracking-[0.3px] text-trace-label">{getLanguageLabel(activeTab)}</span>
                                <CopyButton textToCopy={activeContent} testId="trace-step-copy" />
                            </div>
                        )}
                    </div>

                    <div role="tabpanel">
                        {activeTab === "explanation" ? (
                            <p className="m-0 px-4 pt-1.5 pb-3.5 text-xs leading-[18px] text-text-default whitespace-pre-wrap [overflow-wrap:anywhere]">{step.explanation}</p>
                        ) : activeTab === "code" ? (
                            step.code ? (
                                <CodePanel label={UI_STRINGS.TOOL_MESSAGE.LANGUAGE_JAVASCRIPT} code={step.code} language="javascript" showHeader={false} embedded />
                            ) : (
                                <p className="m-0 px-4 pt-1.5 pb-3.5 text-xs text-text-secondary">{UI_STRINGS.TOOL_MESSAGE.NO_CODE}</p>
                            )
                        ) : activeTab === "input" ? (
                            <CodePanel label={UI_STRINGS.TOOL_MESSAGE.LANGUAGE_JSON} code={argsText} language="json" showHeader={false} embedded />
                        ) : isRunning ? (
                            <div className="flex flex-col gap-2.5 px-4 pt-1.5 pb-3.5" aria-live="polite">
                                <span className="text-xs leading-4 text-text-secondary">{UI_STRINGS.TOOL_MESSAGE.RUNNING}</span>
                                <span className="block h-2.5 w-[60%] rounded-md bg-trace-skeleton animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                                <span className="block h-2.5 w-[40%] rounded-md bg-trace-skeleton animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                            </div>
                        ) : isEmpty ? (
                            <p className="m-0 px-4 pt-1.5 pb-3.5 text-xs text-text-secondary">{UI_STRINGS.TOOL_MESSAGE.NO_OUTPUT}</p>
                        ) : resultText ? (
                            <CodePanel label={UI_STRINGS.TOOL_MESSAGE.LANGUAGE_JSON} code={resultText} language="json" showHeader={false} embedded />
                        ) : (
                            <p className="m-0 px-4 pt-1.5 pb-3.5 text-xs text-text-secondary">{NO_RESULT_TEXT}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

