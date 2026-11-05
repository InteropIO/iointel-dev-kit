import React, { useMemo, useState } from "react";

import { UI_STRINGS } from "../../constants/uiStrings";

const TRUNCATE_LENGTH = 160;

const TAG_PATTERN = /<\/?[a-zA-Z][\w-]*>/g;

const stripToolDescriptionTags = (description: string | undefined): string =>
    (description ?? "")
        .replace(TAG_PATTERN, " ")
        .replace(/\s+/g, " ")
        .trim();

// Truncates `text` to at most `maxLength` characters, backing up to the last whole word — never
// splitting a word in half. Returns `text` unchanged if it already fits.
const truncateToolDescription = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;

    const sliced = text.slice(0, maxLength);
    const lastSpaceIndex = sliced.lastIndexOf(" ");
    const wholeWords = lastSpaceIndex > 0 ? sliced.slice(0, lastSpaceIndex) : sliced;

    return `${wholeWords.trimEnd()}...`;
};

type Props = {
    id?: string;
    description?: string;
};

export const ToolDetails: React.FC<Props> = ({ id, description }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const text = useMemo(() => stripToolDescriptionTags(description), [description]);
    const truncatedText = useMemo(() => truncateToolDescription(text, TRUNCATE_LENGTH), [text]);
    const canExpand = truncatedText !== text;
    const displayText = isExpanded ? text : truncatedText;

    return (
        <div id={id} data-testid="tool-details" className="flex flex-col gap-1 min-w-0 px-4 py-2 border-t border-border-default bg-[var(--app-popover-details-background)]">
            {text ? (
                <>
                    <p className="m-0 whitespace-pre-wrap text-[11.5px] leading-[17px] text-text-default [overflow-wrap:anywhere]">{displayText}</p>
                    {canExpand && (
                        <button
                            type="button"
                            className="inline-flex items-center self-start gap-1.5 -ml-1 px-1 border-0 rounded bg-none text-[11px] leading-4 text-text-default cursor-pointer hover:text-text-states-active focus-visible:outline-none focus-visible:text-text-states-active focus-visible:shadow-[inset_0_0_0_2px_var(--app-focus-ring)]"
                            aria-expanded={isExpanded}
                            onClick={() => setIsExpanded((prev) => !prev)}
                        >
                            {isExpanded ? UI_STRINGS.TOOL_DETAILS.SHOW_LESS : UI_STRINGS.TOOL_DETAILS.SHOW_MORE}
                            <span
                                aria-hidden="true"
                                className={["inline-block w-[5px] h-[5px] border-r-[1.5px] border-b-[1.5px] border-current", isExpanded ? "mt-[3px] -rotate-[135deg]" : "-mt-[3px] rotate-45"].join(" ")}
                            />
                        </button>
                    )}
                </>
            ) : (
                <p className="m-0 text-[11.5px] leading-[17px] text-text-default whitespace-pre-wrap [overflow-wrap:anywhere]">{UI_STRINGS.TOOL_DETAILS.DEFAULT_TOOL_DESCRIPTION}</p>
            )}
        </div>
    );
};
