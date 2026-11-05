import React, { useEffect, useRef, useState } from "react";

import { ToolDetails } from "./ToolDetails";
import { UI_STRINGS } from "../../constants/uiStrings";
import type { UITool } from "../../types";
import { Icon } from "../shared/Icon";
import { InfoIcon } from "../shared/icons";
import { ToggleInput } from "../shared/ToggleInput";

type Props = {
    tool: UITool;
    onToggle: (tool: UITool) => void;
    isDetailsOpen: boolean;
    onToggleDetails: () => void;
    className?: string;
};

export const ToolListItem: React.FC<Props> = ({ tool, onToggle, isDetailsOpen, onToggleDetails, className }) => {
    const [isHovered, setIsHovered] = useState(false);
    const hostRef = useRef<HTMLDivElement>(null);
    const detailsId = `tool-details-${tool.name.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    useEffect(() => {
        if (isDetailsOpen) {
            requestAnimationFrame(() => hostRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
        }
    }, [isDetailsOpen]);

    const handleDetailsToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleDetails();
    };

    return (
        <div ref={hostRef} data-testid="tool-list-item" data-tool-name={tool.name} className={className}>
            <div
                role="button"
                tabIndex={0}
                aria-expanded={isDetailsOpen}
                className={["flex justify-between content-center items-center min-h-[36px] pl-[14px] pr-2 gap-2 cursor-pointer", isDetailsOpen || isHovered ? "bg-app-background-secondary" : ""]
                    .filter(Boolean)
                    .join(" ")}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={handleDetailsToggle}
                onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter") onToggleDetails();
                    if (e.key === " ") {
                        e.preventDefault();
                        onToggleDetails();
                    }
                }}
            >
                <ToggleInput isChecked={tool.enabled} onToggle={() => onToggle(tool)} testId="tool-toggle" />

                <span className={["flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]", isHovered ? "text-text-states-hover" : "text-text-default"].join(" ")}>
                    {tool.name}
                </span>

                <button
                    type="button"
                    data-testid="tool-info-icon"
                    className={[
                        "inline-flex shrink-0 items-center justify-center w-6 h-6 p-0 rounded-full bg-transparent cursor-pointer focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--app-focus-ring)] hover:text-text-states-active",
                        isDetailsOpen || isHovered ? "text-text-states-active" : "text-text-default",
                        isDetailsOpen ? "bg-icon-button-selected hover:bg-icon-button-selected" : "hover:bg-icon-button-hover",
                    ].join(" ")}
                    aria-expanded={isDetailsOpen}
                    aria-controls={detailsId}
                    aria-label={UI_STRINGS.TOOL_LIST_ITEM_COMPONENT.SHOW_DETAILS(tool.name)}
                    onClick={handleDetailsToggle}
                >
                    <Icon size={12}>
                        <InfoIcon />
                    </Icon>
                </button>
            </div>

            {isDetailsOpen && <ToolDetails id={detailsId} description={tool.description} />}
        </div>
    );
};

