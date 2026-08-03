import { inject, Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { IOConnectCore } from "@interopio/core";
import { IOConnectModals } from "@interopio/modals-api";
import { take } from "rxjs/operators";

import { SAMPLING_ACTION } from "./enums";
import { APP_BUTTON_TYPES } from "../../../components/app-button/enum";
import { PANEL_BUTTON_ACTION_TYPE } from "../../../components/app-panel/enums";
import { APP_SELECT_IDS, AppSelectService } from "../../../components/app-select/app-select.service";
import { UI_STRINGS } from "../../../constants/ui-strings";
import { PERMISSION_MODE } from "../../../enums/permission-mode.enum";
import { GetResponseParams } from "../../../store/message/types";
import { ThreadFacade } from "../../../store/thread/thread.facade";
import { AgentService } from "../../agent/agent.service";
import { IOConnectService } from "../../io/io.service";
import { LoggerService } from "../../logger/logger.service";
import { OverlayService } from "../../overlay/overlay.service";
import { SAMPLING_STOP_REASONS } from "../types";

@Injectable({
    providedIn: "root",
})
export class SamplingService {
    private readonly UI_STRINGS = UI_STRINGS.SAMPLING_MODAL;
    private readonly _ioConnectService: IOConnectService = inject(IOConnectService);
    private readonly _agentService: AgentService = inject(AgentService);
    private readonly _appSelectService: AppSelectService = inject(AppSelectService);
    private readonly _overlayService: OverlayService = inject(OverlayService);
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "SamplingService";
    private _isSamplingModalActive = false;

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

        if (this._isSamplingModalActive) {
            this._logger.get(this.LOGGER_NAME).warn("Sampling request rejected: another sampling is already in progress.");

            return {
                code: -1,
                message: "Sampling request rejected: another sampling is already in progress.",
            };
        }

        this._isSamplingModalActive = true;

        try {
            return await this.getSamplingModalResponse(serverName, request);
        } catch (error) {
            this._logger.get(this.LOGGER_NAME).error(`Error occurred while getting sampling modal response: ${error instanceof Error ? error.message : String(error)}`);

            return {
                code: -1,
                message: "An error occurred while processing the sampling request.",
            };
        } finally {
            this._isSamplingModalActive = false;
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

    private async getSamplingModalResponse(serverName: string, request: IoAiWeb.SamplingRequestParams): Promise<IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse> {
        this.getLogger().info(`Showing sampling request from server: ${serverName}, requesting: ${JSON.stringify(request)}`);

        const isModalsApiAvailable: boolean = await this._ioConnectService.isModalsAvailable();

        if (!isModalsApiAvailable) {
            this.getLogger().info("IO Modals not available, using built-in panel for sampling");

            return await this.getBuiltInPanelResponse(request);
        }

        return await this.getModalsApiPanelResponse(request);
    }

    private async getBuiltInPanelResponse(request: IoAiWeb.SamplingRequestParams): Promise<IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse> {
        return new Promise((resolve) => {
            const { overlayRef } = this._overlayService.showPanelOverlay({
                title: this.UI_STRINGS.TITLE,
                content: `<div class="flex flex-col g-2">
                            <span class="text-text-black-white text-lg">Permission to proceed</span>
                            <span class="text-text-default text-sm">${this.UI_STRINGS.TEXT}</span>
                          </div>`,
                isHeaderCloseButtonDisplayed: false,
                footerButtons: [
                    {
                        label: "Continue",
                        action: PANEL_BUTTON_ACTION_TYPE.CUSTOM,
                        type: APP_BUTTON_TYPES.SUBMIT,
                        onClick: () => this.resolveBuiltInPanel(resolve, SAMPLING_ACTION.ACCEPT, request),
                    },
                    {
                        label: "Cancel",
                        action: PANEL_BUTTON_ACTION_TYPE.CUSTOM,
                        type: APP_BUTTON_TYPES.DEFAULT,
                        onClick: () => this.resolveBuiltInPanel(resolve, SAMPLING_ACTION.DECLINE, request),
                    },
                ],
            });

            // The overlay service disposes the overlay on backdrop click;
            // subscribe here so the pending promise resolves as CANCEL instead of hanging.
            overlayRef
                .backdropClick()
                .pipe(take(1))
                .subscribe(() => this.resolveBuiltInPanel(resolve, SAMPLING_ACTION.DECLINE, request));
        });
    }

    private async getModalsApiPanelResponse(request: IoAiWeb.SamplingRequestParams): Promise<IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse> {
        const dialogOptions: IOConnectModals.DialogRequestConfig = {
            templateName: "noInputsConfirmationDialog",
            variables: {
                title: this.UI_STRINGS.TITLE,
                heading: this.UI_STRINGS.HEADING,
                text: this.UI_STRINGS.TEXT,
                actionButtons: [
                    { variant: "primary", text: "Continue", id: "yes" },
                    { variant: "outline", text: "Cancel", id: "no" },
                ],
            },
        };

        const samplingDialogResponse: IOConnectModals.DialogResponse = await this._ioConnectService.requestModalDialog(dialogOptions);

        if (!samplingDialogResponse || !samplingDialogResponse.responseButtonClicked) {
            throw new Error("No response from sampling modal dialog.");
        }

        if (samplingDialogResponse.responseButtonClicked?.id === "yes") {
            return await this.getSamplingResponse(request);
        }

        this._logger.get(this.LOGGER_NAME).info("User denied the sampling request.");

        return {
            code: -1,
            message: "User denied the sampling request.",
        };
    }

    private async resolveBuiltInPanel(
        resolve: (value: IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse) => void,
        action: SAMPLING_ACTION,
        request: IoAiWeb.SamplingRequestParams
    ): Promise<void> {
        this._overlayService.closeCurrentOverlay();
        resolve(await this.handleResponseType(action, request));
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
