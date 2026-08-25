import React, { useState } from "react";

import type { UITool } from "../../types";
import { Icon } from "../shared/Icon";
import { InfoIcon } from "../shared/icons";
import { ToggleInput } from "../shared/ToggleInput";
import { Tooltip } from "../shared/Tooltip";

type Props = {
    tool: UITool;
    onToggle: (tool: UITool) => void;
};

export const ToolListItem: React.FC<Props> = ({ tool, onToggle }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            data-testid="tool-list-item"
            data-tool-name={tool.name}
            // Upstream disables jsx-a11y/no-noninteractive-tabindex here; this template's
            // ESLint config does not load that plugin (no ESLint 10 support), so the
            // directive is dropped and only its rationale is kept: the row itself has no
            // click action (toggle/tooltip are separately focusable children); tabIndex
            // only ports ng's tool-list-item.component.html focusability.
            tabIndex={0}
            className={["flex justify-between items-center px-2 py-1 gap-2 cursor-pointer rounded-md w-full", isHovered ? "bg-app-background-secondary" : ""].filter(Boolean).join(" ")}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <ToggleInput isChecked={tool.enabled} onToggle={() => onToggle(tool)} testId="tool-toggle" />

            <span className={["flex flex-1 text-xs", isHovered ? "text-text-states-hover" : "text-text-default"].join(" ")}>{tool.name}</span>

            <Tooltip
                content={
                    <div className="flex justify-center bg-app-background-secondary text-text-default border border-border-default p-4 rounded-md leading-[17px] text-xs min-w-[240px] max-w-[320px]">
                        <div>
                            <span className="text-text-states-active font-weight-550">Server name: </span>
                            {tool.mcpServerName}
                        </div>
                    </div>
                }
            >
                <span
                    className={["inline-flex items-center justify-center rounded-sm hover:bg-app-icon-background-hover", isHovered ? "text-text-states-active" : "text-text-default"].join(" ")}
                    aria-label="Tool info"
                >
                    <Icon size={12}>
                        <InfoIcon />
                    </Icon>
                </span>
            </Tooltip>
        </div>
    );
};
