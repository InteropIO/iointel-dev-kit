import { inject, Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";

import { IOAiWebService } from "../../io-ai-web/io-ai-web.service";
import { LoggerService } from "../../logger/logger.service";

@Injectable({
    providedIn: "root",
})
export class AgentManagerService {
    private readonly _ioIntelWebService: IOAiWebService = inject(IOAiWebService);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "AgentManagerService";

    public async listAgents(): Promise<IoAiWeb.Agents.Agent[]> {
        try {
            return await this._ioIntelWebService.listAgents();
        } catch (error) {
            this._logger.get(this.LOGGER_NAME).error(`Error fetching agents: ${error instanceof Error ? error.message : String(error)}`);

            throw new Error("Failed to fetch agents.");
        }
    }
}
