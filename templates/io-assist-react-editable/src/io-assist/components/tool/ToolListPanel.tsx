import React, { useEffect, useMemo, useState } from "react";

import { ToolListItem } from "./ToolListItem";
import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";
import { useIoAiWebApi } from "../../hooks/useIoAiWebApi";
import { LOADING_STATES } from "../../types/loading";
import { TOOL_STATES, type UITool } from "../../types/tool";
import { SearchInput } from "../shared/SearchInput";

const DOCS_URL = "https://docs-ai.interop.io/";
const SYSTEM_GROUP_KEY = "system";

type ToolGroup = {
    key: string;
    label: string;
    tools: UITool[];
};

export const ToolListPanel: React.FC = () => {
    const tools = useIoAssistStore((s) => s.tools);
    const toolLoadingState = useIoAssistStore((s) => s.toolLoadingState);
    const { toggleTool, refreshTools } = useIoAiWebApi();

    const [search, setSearch] = useState("");
    const [currentExpandedToolDetails, setCurrentExpandedToolDetails] = useState<string | null>(null);

    // Re-fetch the tool list every time the panel is opened/mounted, mirroring
    // Angular's ToolListComponent.ngOnInit() — tools registered dynamically after
    // app init (e.g. variable/dynamic MCP app tools) otherwise never appear.
    useEffect(() => {
        void refreshTools();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isLoading = toolLoadingState.type === LOADING_STATES.LOADING;
    const hasTools = tools.length > 0;

    const filteredTools = useMemo(() => {
        if (!search) return tools;
        const lower = search.toLowerCase();
        return tools.filter((t) => t.name.toLowerCase().includes(lower));
    }, [tools, search]);

    const hasFilteredTools = !isLoading && filteredTools.length > 0;

    const toolGroups = useMemo<ToolGroup[]>(() => {
        const groups = new Map<string, ToolGroup>();

        for (const tool of filteredTools) {
            const key = tool.isSystemTool ? SYSTEM_GROUP_KEY : `mcp:${tool.mcpServerName ?? ""}`;
            const label = tool.isSystemTool ? UI_STRINGS.TOOL_LIST_COMPONENT.SYSTEM_TOOLS_GROUP : (tool.mcpServerName ?? "");

            const group = groups.get(key) ?? { key, label, tools: [] };
            group.tools.push(tool);
            groups.set(key, group);
        }

        const system = groups.get(SYSTEM_GROUP_KEY);
        groups.delete(SYSTEM_GROUP_KEY);

        return system ? [system, ...groups.values()] : [...groups.values()];
    }, [filteredTools]);

    const handleToggle = (tool: UITool) => {
        if (tool.state !== TOOL_STATES.IDLE) return;
        void toggleTool(tool.name, !tool.enabled);
    };

    const toggleDetails = (toolName: string) => {
        setCurrentExpandedToolDetails((open) => (open === toolName ? null : toolName));
    };

    const onDocsLinkClick = (): void => {
        window.open(DOCS_URL, "_blank", "noopener,noreferrer");
    };

    return (
        <div data-testid="tool-panel" className="flex flex-col flex-1 min-h-0">
            {!isLoading && hasTools && <SearchInput value={search} onChange={setSearch} placeholder={UI_STRINGS.TOOL_LIST_COMPONENT.INPUT_TOOLTIP} testId="tool-filter-input" className="shrink-0 mx-4" />}

            <div className="flex flex-col items-center gap-5 pt-2 pb-6 flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar scroll-fade-edges [scrollbar-gutter:stable] pl-4 pr-[7px] mr-[3px]">
                {isLoading && <span className="text-text-default">{UI_STRINGS.TOOL_LIST_COMPONENT.LOADING_TOOLS}</span>}

                {hasFilteredTools &&
                    toolGroups.map((group) => (
                        <div key={group.key} data-testid="tool-list-group" className="flex flex-col gap-2 w-full">
                            <div data-testid="tool-group-header" className="flex items-center px-[3px]">
                                <span className="text-[10px] font-normal text-text-secondary leading-[13px] tracking-[0.1px]">{group.label}</span>
                            </div>

                            <div data-testid="tool-list-group-items" className="flex flex-col border border-border-default rounded-lg overflow-hidden">
                                {group.tools.map((tool, i) => (
                                    <ToolListItem
                                        key={tool.name}
                                        tool={tool}
                                        onToggle={handleToggle}
                                        isDetailsOpen={currentExpandedToolDetails === tool.name}
                                        onToggleDetails={() => toggleDetails(tool.name)}
                                        className={["block", i > 0 ? "border-t border-border-default" : ""].filter(Boolean).join(" ")}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}

                {hasTools && !hasFilteredTools && !isLoading && (
                    <span data-testid="no-filtered-tools" className="text-text-default text-[13px]">
                        {UI_STRINGS.TOOL_LIST_COMPONENT.NO_FILTERED_TOOLS}
                    </span>
                )}

                {!hasTools && !isLoading && (
                    <div data-testid="no-tools" className="flex flex-col items-center gap-2 text-center px-4">
                        <span className="text-text-default">{UI_STRINGS.TOOL_LIST_COMPONENT.NO_TOOLS}</span>
                        <button type="button" className="text-xs text-blue-500 hover:text-blue-600 underline cursor-pointer" onClick={onDocsLinkClick}>
                            {UI_STRINGS.TOOL_LIST_COMPONENT.NO_TOOLS_SEE_MORE}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

