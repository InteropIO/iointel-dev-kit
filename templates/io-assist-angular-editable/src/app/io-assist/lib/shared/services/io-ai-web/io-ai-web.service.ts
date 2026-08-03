// Re-enable the directive below if the `(window as any).intel` debug line is restored.
// /* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, inject, Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { IoIntelWorkingContext } from "@interopio/working-context";

import { ElicitationService } from "./elicitation/elicitation.service";
import { SamplingService } from "./sampling/sampling.service";
import { IO_ASSIST_CONFIG, IO_ASSIST_DYNAMIC_CONFIG, IoAssistStaticConfig, IoAssistDynamicConfig } from "../../../io-assist.config";
import { LOADING_STATE } from "../../enums/loading-state.enum";
import { LoadingType } from "../../types/loading.type";
import { IOConnectService } from "../io/io.service";
import { LoggerService } from "../logger/logger.service";
import { McpAppsService } from "../mcp-apps/mcp-apps.service";

@Injectable({
    providedIn: "root",
})
export class IOAiWebService {
    private readonly _ioConnectService: IOConnectService = inject(IOConnectService);
    private readonly _samplingService: SamplingService = inject(SamplingService);
    private readonly _elicitationService: ElicitationService = inject(ElicitationService);
    private readonly _ioAssistConfig: IoAssistStaticConfig = inject(IO_ASSIST_CONFIG);
    private readonly _dynamicConfig: Signal<IoAssistDynamicConfig> = inject(IO_ASSIST_DYNAMIC_CONFIG);
    private readonly _logger: LoggerService = inject(LoggerService);
    private readonly LOGGER_NAME: string = "IOAiWebService";
    private readonly _mcpAppsService: McpAppsService = inject(McpAppsService);

    private _ioIntelWeb: WritableSignal<IoAiWeb.API | null> = signal(null);
    private get _ioIntelWebAPI(): IoAiWeb.API {
        const api: IoAiWeb.API | null = this._ioIntelWeb();

        if (!api) {
            throw new Error("IO Intel Web API is not initialized.");
        }

        return api;
    }

    private get _workingContextAPI(): IoIntelWorkingContext.API {
        const api: IoAiWeb.API = this._ioIntelWebAPI;

        if (!api.context) {
            throw new Error("IO Intel Web API does not have working context enabled.");
        }

        return api.context;
    }

    private _loadingState: WritableSignal<LoadingType> = signal({
        type: LOADING_STATE.NOT_STARTED,
    });
    public get loadingState(): Signal<LoadingType> {
        return this._loadingState;
    }
    public get isInitialized(): Signal<boolean> {
        return computed(() => this._ioIntelWeb() !== null && this._loadingState().type === LOADING_STATE.SUCCESS);
    }
    public get isInitializing(): Signal<boolean> {
        return computed(() => this._loadingState().type === LOADING_STATE.LOADING);
    }
    public readonly isError: Signal<string> = computed(() => {
        const loadingState = this._loadingState();

        return (loadingState.type === LOADING_STATE.ERROR && loadingState.message) || "";
    });

    private _hasContextConfig: WritableSignal<boolean> = signal(false);

    /** Note that initialization takes time and must be handled accordingly across components - display proper UI loading indication.
     *  Initialization takes place when the app is mounted.
     */
    public async initialize(): Promise<void> {
        const ioIntelWebAPI: IoAiWeb.API | null = await this._safeInitialize();

        this._logger.get(this.LOGGER_NAME).debug(`IO Intel Web API initialized: ${JSON.stringify(ioIntelWebAPI)}`);

        if (ioIntelWebAPI) {
            // Debug-only global, never read by app/lib code. Commented out to verify
            // nothing depends on it.
            // (window as any).intel = ioIntelWebAPI; // For debugging purposes

            this._ioIntelWeb.set(ioIntelWebAPI);
            this._loadingState.set({ type: LOADING_STATE.SUCCESS });

            this._mcpAppsService.attach(ioIntelWebAPI);

            return;
        }

        const error: Error = new Error("Failed to initialize IoAiWeb API");

        this._loadingState.set({
            type: LOADING_STATE.ERROR,
            message: error.message,
        });

        throw error;
    }

    private async _safeInitialize(): Promise<IoAiWeb.API | null> {
        if (this.isInitialized()) throw new Error("IO Intel Web is already initialized!");

        if (this.isInitializing()) throw new Error("IO Intel Web is already initializing...");

        if (this.isError()) {
            throw new Error(this.isError());
        }

        this._loadingState.set({ type: LOADING_STATE.LOADING });

        const config: IoAiWeb.WebConfig = this.constructConfig();

        this._logger.get(this.LOGGER_NAME).debug(`Initializing IoAiWeb with config: ${JSON.stringify(config)}`);

        try {
            return await this._ioConnectService.initializeIOIntelWeb(config);
        } catch (error) {
            const err = new Error("Error initializing IO Intel Web API: " + (error instanceof Error ? error.message : String(error)));

            this._loadingState.set({
                type: LOADING_STATE.ERROR,
                message: err.message,
            });

            throw err;
        }
    }

    public listAgents(): Promise<IoAiWeb.Agents.Agent[]> {
        return this._ioIntelWebAPI.agents.list();
    }

    public listThreads(config: IoAiWeb.Threads.ListThreadsParams): Promise<IoAiWeb.Threads.Thread[]> {
        return this._ioIntelWebAPI.threads.list(config);
    }

    public deleteThreadState(params: IoAiWeb.Threads.DeleteThreadStateParams): Promise<void> {
        return this._ioIntelWebAPI.threads.deleteThreadState(params);
    }

    public listTools(): Promise<IoAiWeb.Tools.Tool[]> {
        return this._ioIntelWebAPI.tools.list();
    }

    public toggleTool(toolName: string, enable: boolean): Promise<IoAiWeb.Tools.Tool> {
        return Promise.resolve(this._ioIntelWebAPI.tools.toggleTool(toolName, enable));
    }

    public getWorkingContext(): Promise<Record<string, IoIntelWorkingContext.Property>> {
        return Promise.resolve(this._workingContextAPI.get());
    }

    public onWorkingContextChange(callback: (data: Record<string, IoIntelWorkingContext.Property>) => void): IoIntelWorkingContext.UnsubscribeFunction {
        return this._workingContextAPI.onChanged(callback);
    }

    public isWorkingContextEnabled(): Promise<boolean> {
        return Promise.resolve(this._hasContextConfig() && !!this._workingContextAPI);
    }

    private constructConfig(): IoAiWeb.WebConfig {
        const aiWebConfig = this._ioAssistConfig.aiWebConfig;
        const contextConfig = this._ioAssistConfig.workingContext;

        const config: IoAiWeb.WebConfig = {
            agentServer: this.buildAgentServerConfig(aiWebConfig.agentServer),
        };

        config.mcp = this.buildMcpConfig(aiWebConfig.mcp);

        if (contextConfig) {
            this._hasContextConfig.set(true);

            config.context = contextConfig;
        }

        return config;
    }

    private buildAgentServerConfig(agentServer: IoAiWeb.WebConfig["agentServer"]): IoAiWeb.WebConfig["agentServer"] {
        const dynamicHeaders = this._dynamicConfig().agentServer?.headers;
        const result = { ...agentServer };

        if (dynamicHeaders !== undefined) {
            result.headers = dynamicHeaders;
        }

        return result;
    }

    private buildMcpConfig(mcp: IoAiWeb.WebConfig["mcp"]): IoAiWeb.WebConfig["mcp"] {
        return {
            ...mcp,
            clientsConfig: {
                ...mcp?.clientsConfig,
                capabilities: {
                    ...mcp?.clientsConfig?.capabilities,
                    sampling: {
                        handler: this._samplingService.selectSamplingHandler(mcp),
                    },
                    elicitation: {
                        handler: this._elicitationService.selectElicitationHandler(mcp),
                    },
                },
            },
        };
    }
}
