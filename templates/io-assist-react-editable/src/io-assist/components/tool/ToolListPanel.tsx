import React, { useState, useMemo } from "react";

import { ToolListItem } from "./ToolListItem";
import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";
import { useIoAiWebApi } from "../../hooks/useIoAiWebApi";
import { LOADING_STATES } from "../../types/loading";
import { TOOL_STATES, type UITool } from "../../types/tool";
import { SearchInput } from "../shared/SearchInput";

const DOCS_URL = "https://docs-ai.interop.io/";

export const ToolListPanel: React.FC = () => {
    const tools = useIoAssistStore((s) => s.tools);
    const toolLoadingState = useIoAssistStore((s) => s.toolLoadingState);
    const { toggleTool } = useIoAiWebApi();

    const [search, setSearch] = useState("");

    const isLoading = toolLoadingState.type === LOADING_STATES.LOADING;
    const hasTools = tools.length > 0;

    const filteredTools = useMemo(() => {
        if (!search) return tools;
        const lower = search.toLowerCase();
        return tools.filter((t) => t.name.toLowerCase().includes(lower));
    }, [tools, search]);

    const hasFilteredTools = !isLoading && filteredTools.length > 0;

    const handleToggle = (tool: UITool) => {
        if (tool.state !== TOOL_STATES.IDLE) return;
        void toggleTool(tool.name, !tool.enabled);
    };

    const onDocsLinkClick = (): void => {
        window.open(DOCS_URL, "_blank", "noopener,noreferrer");
    };

    return (
        <div data-testid="tool-panel" className="flex flex-col">
            {!isLoading && hasTools && <SearchInput value={search} onChange={setSearch} placeholder={UI_STRINGS.TOOL_LIST_COMPONENT.INPUT_TOOLTIP} testId="tool-filter-input" />}

            <div className="flex flex-col items-center pt-2">
                {isLoading && <span className="text-text-default">{UI_STRINGS.TOOL_LIST_COMPONENT.LOADING_TOOLS}</span>}

                {hasFilteredTools && filteredTools.map((tool) => <ToolListItem key={tool.name} tool={tool} onToggle={handleToggle} />)}

                {hasTools && !hasFilteredTools && !isLoading && <span className="text-text-default">{UI_STRINGS.TOOL_LIST_COMPONENT.NO_FILTERED_TOOLS}</span>}

                {!hasTools && !isLoading && (
                    <div className="flex flex-col items-center gap-2 text-center px-4">
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
