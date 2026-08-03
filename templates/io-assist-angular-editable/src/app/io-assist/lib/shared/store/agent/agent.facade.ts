import { inject, Injectable, Signal } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { Store } from "@ngrx/store";

import { listAvailableAgents, selectAgent } from "./agent.actions";
import { selectAvailableAgents, selectSelectedAgent } from "./agent.selector";

@Injectable({
    providedIn: "root",
})
export class AgentFacade {
    private readonly _store: Store = inject(Store);

    private readonly _availableAgents: Signal<IoAiWeb.Agents.Agent[]> = this._store.selectSignal<IoAiWeb.Agents.Agent[]>(selectAvailableAgents);
    public get availableAgents(): Signal<IoAiWeb.Agents.Agent[]> {
        return this._availableAgents;
    }

    private readonly _selectedAgent: Signal<IoAiWeb.Agents.Agent | null> = this._store.selectSignal<IoAiWeb.Agents.Agent | null>(selectSelectedAgent);
    public get selectedAgent(): Signal<IoAiWeb.Agents.Agent | null> {
        return this._selectedAgent;
    }

    public dispatchListAvailableAgents(): void {
        this._store.dispatch(listAvailableAgents());
    }

    public dispatchSelectAgent(agentId: string): void {
        this._store.dispatch(selectAgent({ agentId }));
    }
}
