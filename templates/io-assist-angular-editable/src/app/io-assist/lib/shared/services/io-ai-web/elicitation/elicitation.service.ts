import { inject, Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { IOConnectCore } from "@interopio/core";

import { ELICITATION_ACTION } from "./enums";
import { validateElicitationRequest } from "./utils";
import { APP_BUTTON_TYPES } from "../../../components/app-button/enum";
import { APP_SELECT_IDS, AppSelectService } from "../../../components/app-select/app-select.service";
import { UI_STRINGS } from "../../../constants/ui-strings";
import { PERMISSION_MODE } from "../../../enums/permission-mode.enum";
import { ThreadFacade } from "../../../store/thread/thread.facade";
import { LoggerService } from "../../logger/logger.service";
import { PermissionRequestService } from "../../permission-request/permission-request.service";

/**
 * Service responsible for handling elicitation requests from the IoAiWeb API.
 *
 * Instructions to keep in mind when developing on how elicitation is handled in IO Assist:
 *
 * - When an elicitation request is received, it is first validated using `validateElicitationRequest`.
 * - An elicitation request is considered valid based on set of checks - currently, it checks if the request is intended for io-tool.
 *    - If the request is VALID, an inline permission card is shown in the chat thread asking for the user's approval to proceed with the elicitation.
 *   - The user has three options on the card:
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
    private readonly UI_STRINGS = UI_STRINGS.ELICITATION_PERMISSION_CARD;
    private readonly _appSelectService: AppSelectService = inject(AppSelectService);
    private readonly _permissionRequestService: PermissionRequestService = inject(PermissionRequestService);
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "ElicitationService";
    private _isElicitationPermissionRequestActive = false;

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

            return this.handleResponseType(ELICITATION_ACTION.CANCEL, `Elicitation request rejected: User was not on the thread that the elicitation request was intended for.`);
        }

        const isRequestValid: boolean = validateElicitationRequest(request, this.getLogger());

        if (!isRequestValid) {
            return this.handleResponseType(ELICITATION_ACTION.CANCEL, "Elicitation request validation failed.");
        }

        if (this._isElicitationPermissionRequestActive) {
            return this.handleResponseType(ELICITATION_ACTION.CANCEL, "Elicitation request rejected: another elicitation is already in progress.");
        }

        this._isElicitationPermissionRequestActive = true;

        try {
            return await this.getElicitationPermissionCardResponse(serverName, request);
        } catch (error) {
            const errorMessage: string = "Error occurred while getting elicitation permission card response. Request canceled. " + (error instanceof Error ? error.message : String(error));

            return this.handleResponseType(ELICITATION_ACTION.CANCEL, errorMessage);
        } finally {
            this._isElicitationPermissionRequestActive = false;
        }
    }

    private async getElicitationPermissionCardResponse(serverName: string, request: IoAiWeb.ElicitationRequestParams): Promise<IoAiWeb.ElicitationResponse> {
        this.getLogger().info(`Showing elicitation request from server: ${serverName}, requesting: ${JSON.stringify(request)}`);

        const description: string = request.message ?? this.UI_STRINGS.FALLBACK_TEXT;

        const action: string = await this._permissionRequestService.request(
            description,
            [
                { id: ELICITATION_ACTION.ACCEPT, label: "Accept", buttonType: APP_BUTTON_TYPES.SUBMIT },
                { id: ELICITATION_ACTION.DECLINE, label: "Decline", buttonType: APP_BUTTON_TYPES.SECONDARY },
                { id: ELICITATION_ACTION.CANCEL, label: "Cancel", buttonType: APP_BUTTON_TYPES.SECONDARY },
            ],
            ELICITATION_ACTION.CANCEL
        );

        return this.handleResponseType(action as ELICITATION_ACTION);
    }

    // TODO: Future Task - Replace dummy data with actual user input handling
    private handleResponseType(type: ELICITATION_ACTION, logMessage?: string): IoAiWeb.ElicitationResponse {
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
