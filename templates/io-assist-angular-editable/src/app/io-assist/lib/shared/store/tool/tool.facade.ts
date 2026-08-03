import { inject, Injectable, Signal } from "@angular/core";
import { Store } from "@ngrx/store";

import { fetchTools, toggleTool } from "./tool.actions";
import { selectAllTools, selectEnabledTools, selectIsFetchingTools } from "./tool.selector";
import { UITool } from "./types";

@Injectable()
export class ToolFacade {
    private readonly _store: Store = inject(Store);

    private readonly _allTools: Signal<UITool[]> = this._store.selectSignal<UITool[]>(selectAllTools);
    public get allTools() {
        return this._allTools;
    }

    private readonly _isFetchingTools: Signal<boolean> = this._store.selectSignal<boolean>(selectIsFetchingTools);
    public get isFetchingTools(): Signal<boolean> {
        return this._isFetchingTools;
    }

    private readonly _enabledTools: Signal<UITool[]> = this._store.selectSignal<UITool[]>(selectEnabledTools);
    public get enabledTools(): Signal<UITool[]> {
        return this._enabledTools;
    }

    public dispatchFetchTools(): void {
        this._store.dispatch(fetchTools());
    }

    public dispatchToggleTool(tool: UITool): void {
        this._store.dispatch(toggleTool({ tool }));
    }
}
