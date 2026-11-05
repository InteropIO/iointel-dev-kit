import { inject, Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { IOConnectCore } from "@interopio/core";

import { SAMPLING_ACTION } from "./enums";
import { APP_BUTTON_TYPES } from "../../../components/app-button/enum";
import { APP_SELECT_IDS, AppSelectService } from "../../../components/app-select/app-select.service";
import { UI_STRINGS } from "../../../constants/ui-strings";
import { PERMISSION_MODE } from "../../../enums/permission-mode.enum";
import { GetResponseParams } from "../../../store/message/types";
import { ThreadFacade } from "../../../store/thread/thread.facade";
import { AgentService } from "../../agent/agent.service";
import { LoggerService } from "../../logger/logger.service";
import { PermissionRequestService } from "../../permission-request/permission-request.service";
import { SAMPLING_STOP_REASONS } from "../types";

@Injectable({
    providedIn: "root",
})
export class SamplingService {
    private readonly UI_STRINGS = UI_STRINGS.SAMPLING_PERMISSION_CARD;
    private readonly _agentService: AgentService = inject(AgentService);
    private readonly _appSelectService: AppSelectService = inject(AppSelectService);
    private readonly _permissionRequestService: PermissionRequestService = inject(PermissionRequestService);
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "SamplingService";
    private _isSamplingPermissionRequestActive = false;

    public async handleSamplingRequest(serverName: string, request: IoAiWeb.SamplingRequestParams): Promise<IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse> {
        const isAutoAccept = this._appSelectService.getSelected(APP_SELECT_IDS.PERMISSION)()?.value === PERMISSION_MODE.AUTO_ACCEPT;

        if (isAutoAccept) {
            this._logger.get(this.LOGGER_NAME).info("Auto-accepting sampling request.");
            return await this.getSamplingResponse(request);
        }

        const requestThreadId: string | undefined = request._meta?.["threadId"];
        const activeThreadId: string | null = this._threadFacade.activeThreadId();
        const isFromBackgroundThread: boolean = Boolean(requestThreadId && activeThreadId !== requestThreadId);

        if (isFromBackgroundThread) {
            this._logger.get(this.LOGGER_NAME).warn(`Sampling request rejected: active thread (${activeThreadId}) does not match request thread (${requestThreadId})`);

            return {
                code: -1,
                message: `Sampling request rejected: User was not on the thread that the request was intended for.`,
            };
        }

        if (this._isSamplingPermissionRequestActive) {
            this._logger.get(this.LOGGER_NAME).warn("Sampling request rejected: another sampling is already in progress.");

            return {
                code: -1,
                message: "Sampling request rejected: another sampling is already in progress.",
            };
        }

        this._isSamplingPermissionRequestActive = true;

        try {
            return await this.getSamplingPermissionCardResponse(serverName, request);
        } catch (error) {
            this._logger.get(this.LOGGER_NAME).error(`Error occurred while getting sampling permission card response: ${error instanceof Error ? error.message : String(error)}`);

            return {
                code: -1,
                message: "An error occurred while processing the sampling request.",
            };
        } finally {
            this._isSamplingPermissionRequestActive = false;
        }
    }

    public selectSamplingHandler(
        mcp: IoAiWeb.WebConfig["mcp"]
    ): (serverName: string, params: IoAiWeb.SamplingRequestParams) => Promise<IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse> {
        if (this.isCustomSamplingHandlerProvided(mcp)) {
            this._logger.get(this.LOGGER_NAME).warn("Using a custom sampling handler provided by user configuration.");

            return mcp!.clientsConfig!.capabilities!.sampling!.handler!;
        }

        return this.handleSamplingRequest.bind(this);
    }

    private async getSamplingPermissionCardResponse(serverName: string, request: IoAiWeb.SamplingRequestParams): Promise<IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse> {
        this.getLogger().info(`Showing sampling request from server: ${serverName}, requesting: ${JSON.stringify(request)}`);

        const action: string = await this._permissionRequestService.request(
            this.UI_STRINGS.TEXT,
            [
                { id: SAMPLING_ACTION.ACCEPT, label: "Allow", buttonType: APP_BUTTON_TYPES.SUBMIT },
                { id: SAMPLING_ACTION.DECLINE, label: "Deny", buttonType: APP_BUTTON_TYPES.SECONDARY },
            ],
            SAMPLING_ACTION.DECLINE
        );

        return await this.handleResponseType(action as SAMPLING_ACTION, request);
    }

    private async handleResponseType(type: SAMPLING_ACTION, request: IoAiWeb.SamplingRequestParams): Promise<IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse> {
        let response: IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse = {
            code: -1,
            message: "Unknown sampling action type.",
        };

        if (type === SAMPLING_ACTION.ACCEPT) {
            this._logger.get(this.LOGGER_NAME).info("User approved the sampling request.");

            response = await this.getSamplingResponse(request);
        }

        if (type === SAMPLING_ACTION.DECLINE) {
            this._logger.get(this.LOGGER_NAME).info("User denied the sampling request.");

            response = {
                code: -1,
                message: "User denied the sampling request.",
            };
        }

        return response;
    }

    // TODO:
    //     - Handle different content types properly (not just text) - currently only text content is handled in our UI
    private async getSamplingResponse(request: IoAiWeb.SamplingRequestParams): Promise<IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse> {
        const formattedMessages = request.messages.map((element: { role: IoAiWeb.SamplingRole; content: IoAiWeb.SamplingContent }) => {
            return {
                id: crypto.randomUUID(),
                role: element.role,
                content: (element.content as IoAiWeb.SamplingTextContent).text,
            };
        });

        // TODO: Add system message as first message in the array
        if (request.systemPrompt) {
            formattedMessages.unshift({
                id: crypto.randomUUID(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                role: "system" as any,
                content: request.systemPrompt,
            });
        }

        this.getLogger().debug(`Formatted messages: ${JSON.stringify(formattedMessages)}`);

        const params: GetResponseParams = {
            messages: formattedMessages,
            instructions: request.systemPrompt,
            system: request.systemPrompt,
            modelSettings: {
                // current model max tokens is 16384 - errors otherwise
                // TODO: Find a value that would work as a fallback value for most models so we successfully generate sampling response
                maxTokens: request.maxTokens, // tried removing max tokens and the result was
                temperature: request.temperature || undefined,
            },
            requestContext: {
                modelPreferences: request.modelPreferences || undefined,
            },
            structuredOutput: {
                schema: request._meta?.["structuredOutput"], // fixedSchema,
            },
        };

        this.getLogger().debug(`Sampling request params: ${JSON.stringify(params)}`);

        const response = await this._agentService.getSamplingResponse(params, true);

        if (!response) {
            throw new Error("Failed to generate response for sampling success response.");
        }

        this.getLogger().info(`Generated response for sampling success response: ${JSON.stringify(response)}`);

        const finalMessage: IoAiWeb.SamplingSuccessResponse = {
            role: "assistant",
            content: {
                type: "text",
                text: response.text,
            },
            model: this._agentService.getSelectedAgentModelId(),
            stopReason: SAMPLING_STOP_REASONS.END_TURN,
        };

        this.getLogger().debug(`Sampling request final response message: ${JSON.stringify(finalMessage)}`);

        return finalMessage;
    }

    private isCustomSamplingHandlerProvided(mcp: IoAiWeb.WebConfig["mcp"]): boolean {
        const condition: boolean = !!mcp?.clientsConfig?.capabilities?.sampling?.handler;

        if (!condition) {
            this.getLogger().warn("No custom sampling handler provided. Using built-in handler.");
        }

        return condition;
    }

    private getLogger(): IOConnectCore.Logger.API {
        return this._logger.get(this.LOGGER_NAME);
    }
}
