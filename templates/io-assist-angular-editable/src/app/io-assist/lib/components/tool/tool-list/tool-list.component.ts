import { CommonModule } from "@angular/common";
import { Component, computed, inject, OnInit, signal, Signal, WritableSignal } from "@angular/core";

import { AppInputComponent } from "../../../shared/components/app-input/app-input.component";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { ToolFacade } from "../../../shared/store/tool/tool.facade";
import { UITool } from "../../../shared/store/tool/types";
import { ToolListItemComponent } from "../tool-list-item/tool-list-item.component";

const MODULES = [CommonModule];
const COMPONENTS = [ToolListItemComponent, AppInputComponent];

const SYSTEM_GROUP_KEY = "system";

type ToolGroup = {
    key: string;
    label: string;
    tools: UITool[];
};

@Component({
    selector: "tool-list",
    templateUrl: "./tool-list.component.html",
    imports: [...MODULES, ...COMPONENTS],
    providers: [ToolFacade],
    host: { class: "flex flex-col flex-1 min-h-0" },
})
export class ToolListComponent implements OnInit {
    protected readonly UI_STRINGS = UI_STRINGS.TOOL_LIST_COMPONENT;

    private readonly _toolFacade: ToolFacade = inject(ToolFacade);

    protected readonly tools: Signal<UITool[]> = this._toolFacade.allTools;
    protected readonly isLoading: Signal<boolean> = this._toolFacade.isFetchingTools;

    protected searchTerm: WritableSignal<string> = signal<string>("");
    protected readonly currentExpandedToolDetails: WritableSignal<string | null> = signal<string | null>(null);

    protected readonly filteredTools: Signal<UITool[]> = computed(() => {
        if (!this.searchTerm()) {
            return this.tools();
        }
        return this.tools().filter((tool) => tool.name.toLowerCase().includes(this.searchTerm().toLowerCase()));
    });

    protected readonly toolGroups: Signal<ToolGroup[]> = computed<ToolGroup[]>(() => {
        const groups = new Map<string, ToolGroup>();

        for (const tool of this.filteredTools()) {
            const isSystemTool = tool._meta?.io_connect_system_tool === true;
            const key = isSystemTool ? SYSTEM_GROUP_KEY : `mcp:${tool.source.mcpName}`;
            const label = isSystemTool ? this.UI_STRINGS.SYSTEM_TOOLS_GROUP : tool.source.mcpName;

            const group = groups.get(key) ?? { key, label, tools: [] };
            group.tools.push(tool);
            groups.set(key, group);
        }

        const system = groups.get(SYSTEM_GROUP_KEY);
        groups.delete(SYSTEM_GROUP_KEY);

        return system ? [system, ...groups.values()] : [...groups.values()];
    });

    public ngOnInit(): void {
        this._toolFacade.dispatchFetchTools();
    }

    protected toggleDetails(toolName: string): void {
        this.currentExpandedToolDetails.update((open) => (open === toolName ? null : toolName));
    }

    public onDocsLinkClick(): void {
        window.open("https://docs-ai.interop.io/api-reference/mcp-core/api-reference?_highlight=tools#tool-availability", "_blank", "noopener,noreferrer");
    }
}
