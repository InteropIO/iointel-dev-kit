import { inject, Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { IOConnectCore } from "@interopio/core";
import { IOConnectModals } from "@interopio/modals-api";
import { take } from "rxjs/operators";

import { ELICITATION_ACTION } from "./enums";
import { validateElicitationRequest } from "./utils";
import { APP_BUTTON_TYPES } from "../../../components/app-button/enum";
import { PANEL_BUTTON_ACTION_TYPE } from "../../../components/app-panel/enums";
import { APP_SELECT_IDS, AppSelectService } from "../../../components/app-select/app-select.service";
import { UI_STRINGS } from "../../../constants/ui-strings";
import { PERMISSION_MODE } from "../../../enums/permission-mode.enum";
import { ThreadFacade } from "../../../store/thread/thread.facade";
import { IOConnectService } from "../../io/io.service";
import { LoggerService } from "../../logger/logger.service";
import { OverlayService } from "../../overlay/overlay.service";

/**
 * Service responsible for handling elicitation requests from the IoAiWeb API.
 *
 * Instructions to keep in mind when developing on how elicitation is handled in IO Assist:
 *
 * - When an elicitation request is received, it is first validated using `validateElicitationRequest`.
 * - An elicitation request is considered valid based on set of checks - currently, it checks if the request is intended for io-tool.
 *    - If the request is VALID, a modal dialog is presented to the user asking for their approval to proceed with the elicitation.
 *   - The user has three options in the modal dialog:
 *      - ACCEPT: The user agrees to provide the requested information.
 *         - We are currently using dummy data for the elicited information. In the future, this should be replaced with actual user input handling
 *           TODO: Future Task - Replace dummy data with actual user input handling - https://interopio.atlassian.net/browse/IOINTEL-160
 *      - DECLINE: The user refuses to provide the requested information. A rejection response is sent back.
 *      - CANCEL: The user cancels the elicitation request. A cancel response is sent back.
 *   - If the request is INVALID or if any error occurs during the process, the request is automatically canceled.
 *
 */
@Injectable({
    providedIn: "root",
})
export class ElicitationService {
    private readonly UI_STRINGS = UI_STRINGS.ELICITATION_MODAL;
    private readonly _ioConnectService: IOConnectService = inject(IOConnectService);
    private readonly _appSelectService: AppSelectService = inject(AppSelectService);
    private readonly _overlayService: OverlayService = inject(OverlayService);
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "ElicitationService";
    private _isElicitationModalActive = false;

    public selectElicitationHandler(mcp: IoAiWeb.WebConfig["mcp"]): (serverName: string, params: IoAiWeb.ElicitationRequestParams) => Promise<IoAiWeb.ElicitationResponse> {
        if (this.isCustomElicitationHandlerProvided(mcp)) {
            this._logger.get(this.LOGGER_NAME).warn("Using a custom elicitation handler provided by user configuration.");

            return mcp!.clientsConfig!.capabilities!.elicitation!.handler!;
        }

        return this.handleElicitationRequest.bind(this);
    }

    public async handleElicitationRequest(serverName: string, request: IoAiWeb.ElicitationRequestParams): Promise<IoAiWeb.ElicitationResponse> {
        const isAutoAccept = this._appSelectService.getSelected(APP_SELECT_IDS.PERMISSION)()?.value === PERMISSION_MODE.AUTO_ACCEPT;

        if (isAutoAccept) {
            this.getLogger().info("Auto-accepting elicitation request.");
            return this.handleResponseType(ELICITATION_ACTION.ACCEPT);
        }

        const requestThreadId: string | undefined = request._meta?.["threadId"];
        const activeThreadId: string | null = this._threadFacade.activeThreadId();
        const isFromBackgroundThread: boolean = Boolean(requestThreadId && activeThreadId !== requestThreadId);

        if (isFromBackgroundThread) {
            this.getLogger().warn(`Elicitation request rejected: active thread (${activeThreadId}) does not match request thread (${requestThreadId})`);

            return this.handleResponseType(ELICITATION_ACTION.CANCEL, undefined, `Elicitation request rejected: User was not on the thread that the elicitation request was intended for.`);
        }

        const isRequestValid: boolean = validateElicitationRequest(request, this.getLogger());

        if (!isRequestValid) {
            return this.handleResponseType(ELICITATION_ACTION.CANCEL, undefined, "Elicitation request validation failed.");
        }

        if (this._isElicitationModalActive) {
            return this.handleResponseType(ELICITATION_ACTION.CANCEL, undefined, "Elicitation request rejected: another elicitation is already in progress.");
        }

        this._isElicitationModalActive = true;

        try {
            return await this.getElicitationModalResponse(serverName, request);
        } catch (error) {
            const errorMessage: string = "Error occurred while getting elicitation modal response. Request canceled. " + (error instanceof Error ? error.message : String(error));

            return this.handleResponseType(ELICITATION_ACTION.CANCEL, undefined, errorMessage);
        } finally {
            this._isElicitationModalActive = false;
        }
    }

    private async getElicitationModalResponse(serverName: string, request: IoAiWeb.ElicitationRequestParams): Promise<IoAiWeb.ElicitationResponse> {
        this.getLogger().info(`Showing elicitation request from server: ${serverName}, requesting: ${JSON.stringify(request)}`);

        const isModalsApiAvailable: boolean = await this._ioConnectService.isModalsAvailable();

        if (!isModalsApiAvailable) {
            this.getLogger().info("IO Modals not available, using built-in panel for elicitation");

            return await this.getBuiltInPanelResponse(request);
        }

        return await this.getModalsApiPanelResponse(request);
    }

    private async getBuiltInPanelResponse(request: IoAiWeb.ElicitationRequestParams): Promise<IoAiWeb.ElicitationResponse> {
        return new Promise((resolve) => {
            const message = request.message ?? this.UI_STRINGS.FALLBACK_TEXT;

            const { overlayRef } = this._overlayService.showPanelOverlay({
                title: this.UI_STRINGS.TITLE,
                content: `<div class="flex flex-col g-2">
                            <span class="text-text-black-white text-lg">Permission to proceed</span>
                            <span class="text-text-default text-sm">${message}</span>
                          </div>`,
                isHeaderCloseButtonDisplayed: false,
                footerButtons: [
                    {
                        label: "Accept",
                        action: PANEL_BUTTON_ACTION_TYPE.CUSTOM,
                        type: APP_BUTTON_TYPES.SUBMIT,
                        onClick: () => this.resolveBuiltInPanel(resolve, ELICITATION_ACTION.ACCEPT),
                    },
                    {
                        label: "Decline",
                        action: PANEL_BUTTON_ACTION_TYPE.CUSTOM,
                        type: APP_BUTTON_TYPES.DEFAULT,
                        onClick: () => this.resolveBuiltInPanel(resolve, ELICITATION_ACTION.DECLINE),
                    },
                    {
                        label: "Cancel",
                        action: PANEL_BUTTON_ACTION_TYPE.CUSTOM,
                        type: APP_BUTTON_TYPES.DEFAULT,
                        onClick: () => this.resolveBuiltInPanel(resolve, ELICITATION_ACTION.CANCEL),
                    },
                ],
            });

            // The overlay service disposes the overlay on backdrop click;
            // subscribe here so the pending promise resolves as CANCEL instead of hanging.
            overlayRef
                .backdropClick()
                .pipe(take(1))
                .subscribe(() => this.resolveBuiltInPanel(resolve, ELICITATION_ACTION.CANCEL));
        });
    }

    private async getModalsApiPanelResponse(request: IoAiWeb.ElicitationRequestParams): Promise<IoAiWeb.ElicitationResponse> {
        const dialogOptions: IOConnectModals.DialogRequestConfig = {
            templateName: "noInputsConfirmationDialog",
            variables: {
                title: this.UI_STRINGS.TITLE,
                heading: this.UI_STRINGS.HEADING,
                text: request.message ?? this.UI_STRINGS.FALLBACK_TEXT,
                actionButtons: [
                    { variant: "primary", text: "Accept", id: ELICITATION_ACTION.ACCEPT },
                    { variant: "outline", text: "Decline", id: ELICITATION_ACTION.DECLINE },
                    { variant: "outline", text: "Cancel", id: ELICITATION_ACTION.CANCEL },
                ],
            },
        };

        const elicitationDialogResponse: IOConnectModals.DialogResponse = await this._ioConnectService.requestModalDialog(dialogOptions);

        if (!elicitationDialogResponse || !elicitationDialogResponse.responseButtonClicked) {
            throw new Error("No response from elicitation modal dialog.");
        }

        switch (elicitationDialogResponse.responseButtonClicked.id) {
            case ELICITATION_ACTION.ACCEPT:
                return this.handleResponseType(ELICITATION_ACTION.ACCEPT);
            case ELICITATION_ACTION.DECLINE:
                return this.handleResponseType(ELICITATION_ACTION.DECLINE);
            case ELICITATION_ACTION.CANCEL:
                return this.handleResponseType(ELICITATION_ACTION.CANCEL);
            default:
                // At this point probably a timeout has occurred
                return this.handleResponseType(ELICITATION_ACTION.CANCEL, undefined, "Elicitation dialog was closed without a response.");
        }
    }

    private resolveBuiltInPanel(resolve: (value: IoAiWeb.ElicitationResponse) => void, action: ELICITATION_ACTION): void {
        this._overlayService.closeCurrentOverlay();
        resolve(this.handleResponseType(action));
    }

    // TODO: Future Task - Replace dummy data with actual user input handling
    private handleResponseType(type: ELICITATION_ACTION, onBuiltInPanelResponse?: (value: IoAiWeb.ElicitationResponse) => void, logMessage?: string): IoAiWeb.ElicitationResponse {
        if (onBuiltInPanelResponse) {
            this._overlayService.closeCurrentOverlay();
        }

        let response: IoAiWeb.ElicitationResponse | undefined;

        if (type === ELICITATION_ACTION.ACCEPT) {
            this.getLogger().info(logMessage ?? "User accepted the elicitation request.");

            response = {
                action: ELICITATION_ACTION.ACCEPT,
                // Our internal io_connect tools do not expect any content back and we do not support external elicitation requests yet
                content: {},
            };
        }

        if (type === ELICITATION_ACTION.DECLINE) {
            this._logger.get(this.LOGGER_NAME).info(logMessage ?? "User declined the elicitation request.");
            response = {
                action: ELICITATION_ACTION.DECLINE,
            };
        }

        if (type === ELICITATION_ACTION.CANCEL) {
            this._logger.get(this.LOGGER_NAME).info(logMessage ?? "User canceled the elicitation request.");
            response = {
                action: ELICITATION_ACTION.CANCEL,
            };
        }

        if (!response) {
            throw new Error("No response generated for the given elicitation action type.");
        }

        if (onBuiltInPanelResponse) {
            onBuiltInPanelResponse(response);
        }

        return response;
    }

    private isCustomElicitationHandlerProvided(mcp: IoAiWeb.WebConfig["mcp"]): boolean {
        const condition: boolean = !!mcp?.clientsConfig?.capabilities?.elicitation?.handler;

        if (!condition) {
            this.getLogger().warn("No custom elicitation handler provided. Using built-in handler.");
        }

        return condition;
    }

    private getLogger(): IOConnectCore.Logger.API {
        return this._logger.get(this.LOGGER_NAME);
    }
}
