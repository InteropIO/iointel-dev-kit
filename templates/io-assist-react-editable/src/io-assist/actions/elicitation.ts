import type { IoAiWeb } from "@interopio/ai-web";

import { ELICITATION_ACTION } from "../constants/modalActions";
import type { ElicitationAction } from "../constants/modalActions";
import { UI_STRINGS } from "../constants/uiStrings";
import { ioAssistStore } from "../stores";
import { PERMISSION_MODE } from "../stores/permission-mode";
import { logger } from "../utils/logger";
import { requestPermission } from "../utils/permissionRequest";
import { safeStringify } from "../utils/safeStringify";

const LOGGER_NAME = "Elicitation";
const log = logger.get(LOGGER_NAME);

type ElicitationResponse =
    | { action: typeof ELICITATION_ACTION.ACCEPT; content: Record<string, unknown> }
    | { action: typeof ELICITATION_ACTION.DECLINE }
    | { action: typeof ELICITATION_ACTION.CANCEL };

// Guards against a second elicitation permission request card opening while one is still pending.
// Mirrors ng's `_isElicitationPermissionRequestActive` flag.
let isElicitationPermissionRequestActive = false;

export function selectElicitation(mcp: IoAiWeb.MCPConfig | undefined): (serverName: string, params: IoAiWeb.ElicitationRequestParams) => Promise<ElicitationResponse> {
    const custom = mcp?.clientsConfig?.capabilities?.elicitation?.handler;
    if (typeof custom === "function") {
        log.warn("Using a custom elicitation handler provided by user configuration.");
        return custom;
    }
    log.warn("No custom elicitation handler provided. Using built-in handler.");
    return handleElicitationRequest;
}

export async function handleElicitationRequest(serverName: string, request: IoAiWeb.ElicitationRequestParams): Promise<ElicitationResponse> {
    // Permission mode is checked first: in auto-accept mode we respond directly
    // regardless of which thread the request originates from (foreground or
    // background). Only in ask mode does the originating thread matter.
    if (ioAssistStore.getState().permissionMode === PERMISSION_MODE.AUTO_ACCEPT) {
        return buildResponse(ELICITATION_ACTION.ACCEPT, "Auto-accepting elicitation request.");
    }

    const requestThreadId: string | undefined = request?._meta?.threadId;
    const activeThreadId = ioAssistStore.getState().activeThreadId;
    const isFromBackgroundThread = Boolean(requestThreadId && activeThreadId !== requestThreadId);

    if (isFromBackgroundThread) {
        log.warn(`Elicitation request rejected: active thread (${activeThreadId}) does not match request thread (${requestThreadId})`);
        return buildResponse(ELICITATION_ACTION.CANCEL, "Elicitation request rejected: User was not on the thread that the elicitation request was intended for.");
    }

    if (!validateElicitationRequest(request)) {
        return buildResponse(ELICITATION_ACTION.CANCEL, "Elicitation request validation failed.");
    }

    if (isElicitationPermissionRequestActive) {
        return buildResponse(ELICITATION_ACTION.CANCEL, "Elicitation request rejected: another elicitation is already in progress.");
    }

    isElicitationPermissionRequestActive = true;
    try {
        return await getElicitationPermissionCardResponse(serverName, request);
    } catch (error) {
        const message = "Error occurred while getting elicitation permission card response. Request canceled. " + (error instanceof Error ? error.message : String(error));
        return buildResponse(ELICITATION_ACTION.CANCEL, message);
    } finally {
        isElicitationPermissionRequestActive = false;
    }
}

function validateElicitationRequest(request: IoAiWeb.ElicitationRequestParams): boolean {
    const meta = request?._meta;
    if (!meta || !meta.toolName) {
        log.warn("Elicitation request is missing required _meta.toolName field.");
        return false;
    }
    const toolName = meta.toolName;
    if (typeof toolName !== "string" || toolName.trim().length === 0) {
        log.warn("Elicitation request has invalid _meta.toolName field.");
        return false;
    }
    if (!toolName.startsWith("io_connect")) {
        log.warn("Elicitation request is not intended for io_connect.");
        return false;
    }
    return true;
}

async function getElicitationPermissionCardResponse(serverName: string, request: IoAiWeb.ElicitationRequestParams): Promise<ElicitationResponse> {
    log.info(`Showing elicitation request from server: ${serverName}, requesting: ${safeStringify(request)}`);

    const description = typeof request?.message === "string" ? request.message : UI_STRINGS.ELICITATION_PERMISSION_CARD.FALLBACK_TEXT;

    const buttonId = await requestPermission(
        description,
        [
            { id: ELICITATION_ACTION.ACCEPT, label: "Accept", variant: "primary" },
            { id: ELICITATION_ACTION.DECLINE, label: "Decline", variant: "default" },
            { id: ELICITATION_ACTION.CANCEL, label: "Cancel", variant: "default" },
        ],
        ELICITATION_ACTION.CANCEL
    );

    if (buttonId === ELICITATION_ACTION.ACCEPT) return buildResponse(ELICITATION_ACTION.ACCEPT);
    if (buttonId === ELICITATION_ACTION.DECLINE) return buildResponse(ELICITATION_ACTION.DECLINE);
    return buildResponse(ELICITATION_ACTION.CANCEL, "Elicitation request was dismissed without a response.");
}

function buildResponse(action: ElicitationAction, logMessage?: string): ElicitationResponse {
    if (action === ELICITATION_ACTION.ACCEPT) {
        log.info(logMessage ?? "User accepted the elicitation request.");
        return { action: ELICITATION_ACTION.ACCEPT, content: {} };
    }
    if (action === ELICITATION_ACTION.DECLINE) {
        log.info(logMessage ?? "User declined the elicitation request.");
        return { action: ELICITATION_ACTION.DECLINE };
    }
    log.info(logMessage ?? "User canceled the elicitation request.");
    return { action: ELICITATION_ACTION.CANCEL };
}

