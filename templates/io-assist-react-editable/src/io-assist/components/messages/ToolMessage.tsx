import React, { useMemo } from "react";

import { MdFormatter } from "./MdFormatter";
import { textToJSONMarkdown } from "./mdUtils";
import { UI_STRINGS } from "../../constants/uiStrings";
import { TOOL_RESULT_TYPES, type ToolResult, type UIToolMessage } from "../../types/message";
import { ChevronDownIcon, ChevronUpIcon, CircleFilledIcon, CircleOutlineIcon } from "../shared/icons";

type Props = {
    tool: UIToolMessage;
    parentToolTraceId: string;
    onToggle: (toolId: string, parentId: string) => void;
};

const parseTextResult = (result: ToolResult): unknown => {
    if (result.type !== TOOL_RESULT_TYPES.TEXT) return result;
    try {
        return { type: result.type, text: JSON.parse(result.text) };
    } catch {
        return { type: result.type, text: result.text };
    }
};

const resultToJSONMarkdown = (result: UIToolMessage["result"]): string => {
    if (result === undefined || result === null) return "No result available.";
    if (!Array.isArray(result)) return textToJSONMarkdown(parseTextResult(result));
    return result.map((r) => textToJSONMarkdown(parseTextResult(r))).join("\n\n---\n\n");
};

export const ToolMessage: React.FC<Props> = ({ tool, parentToolTraceId, onToggle }) => {
    const hasResult = tool.result !== undefined && tool.result !== null;
    const isExpanded = !!tool.isExpanded;

    const argsMd = useMemo(() => textToJSONMarkdown(tool.args ?? {}), [tool.args]);
    const resultMd = useMemo(() => resultToJSONMarkdown(tool.result), [tool.result]);

    return (
        <div data-testid="tool-message" className="flex flex-col justify-start py-2 px-[3px] text-[13px] font-weight-weight-600 leading-[100%] text-text-states-active">
            <div className="flex items-center gap-2 px-1">
                <span
                    data-testid="tool-item-dot"
                    title={hasResult ? UI_STRINGS.TOOL_MESSAGE.TOOL_EXECUTION_SUCCESS : UI_STRINGS.TOOL_MESSAGE.TOOL_EXECUTION_PENDING}
                    className={["w-1.5 h-1.5 shrink-0 inline-flex items-center justify-center", hasResult ? "text-app-accent-color-1" : "text-text-states-active"].join(" ")}
                >
                    {hasResult ? <CircleFilledIcon /> : <CircleOutlineIcon />}
                </span>

                <button
                    type="button"
                    data-testid="tool-item-header"
                    className="tool-message__header flex flex-1 items-center cursor-pointer text-left"
                    onClick={() => onToggle(tool.id, parentToolTraceId)}
                >
                    <div className="flex flex-1 ps-2 items-center">{tool.toolName}</div>
                    <span className="size-3 shrink-0 inline-flex items-center justify-center">{isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}</span>
                </button>
            </div>

            {isExpanded && (
                <div data-testid="tool-item-detail" className="tool-message__detail-pane flex flex-col gap-4 pt-2 px-2 w-full">
                    <div className="px-3 border-l border-text-default">
                        <div className="px-2 flex flex-col">
                            <span>Input</span>
                            <MdFormatter content={argsMd} />

                            <span>Output</span>
                            <MdFormatter content={resultMd} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
