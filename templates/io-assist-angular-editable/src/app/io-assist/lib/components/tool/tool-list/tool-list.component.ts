import { CommonModule } from "@angular/common";
import { Component, computed, inject, OnInit, signal, Signal, WritableSignal } from "@angular/core";

import { AppInputComponent } from "../../../shared/components/app-input/app-input.component";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { ToolFacade } from "../../../shared/store/tool/tool.facade";
import { UITool } from "../../../shared/store/tool/types";
import { ToolListItemComponent } from "../tool-list-item/tool-list-item.component";

const MODULES = [CommonModule];
const COMPONENTS = [ToolListItemComponent, AppInputComponent];

@Component({
    selector: "tool-list",
    templateUrl: "./tool-list.component.html",
    imports: [...MODULES, ...COMPONENTS],
    providers: [ToolFacade],
})
export class ToolListComponent implements OnInit {
    protected readonly UI_STRINGS = UI_STRINGS.TOOL_LIST_COMPONENT;

    private readonly _toolFacade: ToolFacade = inject(ToolFacade);

    protected readonly tools: Signal<UITool[]> = this._toolFacade.allTools;
    protected readonly isLoading: Signal<boolean> = this._toolFacade.isFetchingTools;

    protected searchTerm: WritableSignal<string> = signal<string>("");

    protected readonly filteredTools: Signal<UITool[]> = computed(() => {
        if (!this.searchTerm()) {
            return this.tools();
        }
        return this.tools().filter((tool) => tool.name.toLowerCase().includes(this.searchTerm().toLowerCase()));
    });

    public ngOnInit(): void {
        this._toolFacade.dispatchFetchTools();
    }

    public onDocsLinkClick(): void {
        // TODO: Provide the exact link to io-assist
        window.open("https://docs-ai.interop.io/", "_blank", "noopener,noreferrer");
    }
}
