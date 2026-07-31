import { inject, Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { IOConnectCore } from "@interopio/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { mergeMap, from, of, map, catchError, tap } from "rxjs";

import { listAvailableAgents, listAvailableAgentsFailure, listAvailableAgentsSuccess } from "./agent.actions";
import { AgentFacade } from "./agent.facade";
import { IO_ASSIST_CONFIG, IoAssistStaticConfig } from "../../../io-assist.config";
import { AgentManagerService } from "../../services/agent/agent-manager/agent-manager.service";
import { LoggerService } from "../../services/logger/logger.service";

@Injectable()
export class AgentEffects {
    private readonly _actions$: Actions = inject(Actions);
    private readonly _agentManagerService: AgentManagerService = inject(AgentManagerService);
    private readonly _agentFacade: AgentFacade = inject(AgentFacade);
    private readonly _config: IoAssistStaticConfig = inject(IO_ASSIST_CONFIG);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "AgentEffects";

    listAvailableAgents$ = createEffect(() =>
        this._actions$.pipe(
            ofType(listAvailableAgents),
            mergeMap(() =>
                from(this._agentManagerService.listAgents()).pipe(
                    map((agents: IoAiWeb.Agents.Agent[]) => listAvailableAgentsSuccess({ agents })),
                    catchError((error: Error) => of(listAvailableAgentsFailure({ error })))
                )
            )
        )
    );

    onListAvailableAgentsSuccess$ = createEffect(
        () =>
            this._actions$.pipe(
                ofType(listAvailableAgentsSuccess),
                tap(({ agents }) => {
                    if (!agents || agents.length === 0) {
                        this.getLogger().error("No agents available.");

                        return;
                    }

                    if (this._config.defaultAgentName) {
                        this.getLogger().info(`Default agent specified in config: ${this._config.defaultAgentName}`);
                    }

                    let configuredAgentId = this._config.defaultAgentName;

                    if (!configuredAgentId) {
                        this.getLogger().warn(`No default agent specified in config. Selecting first available agent: "${agents[0].id}".`);

                        configuredAgentId = agents[0].id;
                    }

                    let agentMatch: IoAiWeb.Agents.Agent | undefined = agents.find((agent) => agent.id === configuredAgentId);

                    if (!agentMatch) {
                        this.getLogger().error(`Agent with id: "${configuredAgentId}" not found among available agents. Using first available agent: "${agents[0].id}".`);

                        agentMatch = agents[0];
                    }

                    this.getLogger().info(`Working with agent: "${agentMatch.id}"`);

                    this._agentFacade.dispatchSelectAgent(agentMatch.id);
                })
            ),
        { dispatch: false }
    );

    private getLogger(): IOConnectCore.Logger.API {
        return this._logger.get(this.LOGGER_NAME);
    }
}
