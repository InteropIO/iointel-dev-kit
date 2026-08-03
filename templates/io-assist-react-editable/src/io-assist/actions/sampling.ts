import type { IoAiWeb } from "@interopio/ai-web";

import { SAMPLING_ACTION } from "../constants/modalActions";
import { UI_STRINGS } from "../constants/uiStrings";
import { ioAssistStore } from "../stores";
import { PERMISSION_MODE } from "../stores/permission-mode";
import { showConfirmModal, MODAL_PREEMPTED } from "../utils/confirmModal";
import { isModalsAvailable, requestModalDialog } from "../utils/ioModals";
import { logger } from "../utils/logger";
import { extractTextContent } from "../utils/messageConverter";
import { safeStringify } from "../utils/safeStringify";

const LOGGER_NAME = "Sampling";
const log = logger.get(LOGGER_NAME);

type SamplingResponse = IoAiWeb.SamplingSuccessResponse | IoAiWeb.SamplingErrorResponse;

type SamplingMessage = IoAiWeb.SamplingRequestParams["messages"][number];

// Guards against a second sampling consent modal opening while one is still
// pending. Mirrors ng's `_isSamplingModalActive` flag.
let isSamplingModalActive = false;

export function selectSampling(mcp: IoAiWeb.MCPConfig | undefined): (serverName: string, params: IoAiWeb.SamplingRequestParams) => Promise<SamplingResponse> {
    const custom = mcp?.clientsConfig?.capabilities?.sampling?.handler;
    if (typeof custom === "function") {
        log.warn("Using a custom sampling handler provided by user configuration.");
        return custom;
    }
    log.warn("No custom sampling handler provided. Using built-in handler.");
    return handleSamplingRequest;
}

export async function handleSamplingRequest(serverName: string, request: IoAiWeb.SamplingRequestParams): Promise<SamplingResponse> {
    // Permission mode is checked first: in auto-accept mode we respond directly
    // regardless of which thread the request originates from (foreground or
    // background). Only in ask mode does the originating thread matter.
    if (ioAssistStore.getState().permissionMode === PERMISSION_MODE.AUTO_ACCEPT) {
        log.info("Auto-accepting sampling request.");
        return await getSamplingResponse(request);
    }

    const requestThreadId: string | undefined = request?._meta?.threadId;
    const activeThreadId = ioAssistStore.getState().activeThreadId;
    const isFromBackgroundThread = Boolean(requestThreadId && activeThreadId !== requestThreadId);

    if (isFromBackgroundThread) {
        log.warn(`Sampling request rejected: active thread (${activeThreadId}) does not match request thread (${requestThreadId})`);
        return {
            code: -1,
            message: "Sampling request rejected: User was not on the thread that the request was intended for.",
        };
    }

    if (isSamplingModalActive) {
        log.warn("Sampling request rejected: another sampling is already in progress.");
        return {
            code: -1,
            message: "Sampling request rejected: another sampling is already in progress.",
        };
    }

    isSamplingModalActive = true;
    try {
        return await getSamplingModalResponse(serverName, request);
    } catch (error) {
        log.error(`Error occurred while getting sampling modal response: ${error instanceof Error ? error.message : String(error)}`);
        return { code: -1, message: "An error occurred while processing the sampling request." };
    } finally {
        isSamplingModalActive = false;
    }
}

async function getSamplingModalResponse(serverName: string, request: IoAiWeb.SamplingRequestParams): Promise<SamplingResponse> {
    log.info(`Showing sampling request from server: ${serverName}, requesting: ${safeStringify(request)}`);

    const modalsAvailable = await isModalsAvailable();
    const accepted = modalsAvailable ? await getModalsApiResponse() : await getBuiltInPanelResponse();

    if (accepted) {
        log.info("User approved the sampling request.");
        return await getSamplingResponse(request);
    }

    log.info("User denied the sampling request.");
    return { code: -1, message: "User denied the sampling request." };
}

async function getModalsApiResponse(): Promise<boolean> {
    const response = await requestModalDialog({
        templateName: "noInputsConfirmationDialog",
        variables: {
            title: UI_STRINGS.SAMPLING_MODAL.TITLE,
            heading: UI_STRINGS.SAMPLING_MODAL.HEADING,
            text: UI_STRINGS.SAMPLING_MODAL.TEXT,
            actionButtons: [
                { variant: "primary", text: "Continue", id: "yes" },
                { variant: "outline", text: "Cancel", id: "no" },
            ],
        },
    });
    return response?.responseButtonClicked?.id === "yes";
}

async function getBuiltInPanelResponse(): Promise<boolean> {
    const buttonId = await showConfirmModal({
        title: UI_STRINGS.SAMPLING_MODAL.TITLE,
        heading: UI_STRINGS.SAMPLING_MODAL.HEADING,
        text: UI_STRINGS.SAMPLING_MODAL.TEXT,
        buttons: [
            { id: SAMPLING_ACTION.ACCEPT, label: "Continue", variant: "primary" },
            { id: SAMPLING_ACTION.DECLINE, label: "Cancel", variant: "default" },
        ],
    });
    if (buttonId === MODAL_PREEMPTED) {
        log.warn("Sampling consent modal was preempted by another modal; treating as decline.");
        return false;
    }
    return buttonId === SAMPLING_ACTION.ACCEPT;
}

async function getSamplingResponse(request: IoAiWeb.SamplingRequestParams): Promise<SamplingResponse> {
    const selectedAgent = ioAssistStore.getState().selectedAgent;
    if (!selectedAgent) {
        return { code: -1, message: "No agent available for sampling." };
    }

    log.debug(`Preparing to generate sampling response with request: ${safeStringify(request)}`);

    type FormattedMessage = {
        id: string;
        role: SamplingMessage["role"] | "system";
        content: string;
    };

    const formattedMessages: FormattedMessage[] = (request?.messages ?? []).map((element: SamplingMessage) => ({
        id: crypto.randomUUID(),
        role: element?.role,
        content: extractTextContent(element?.content),
    }));

    log.debug(`Formatted messages for sampling request: ${safeStringify(formattedMessages)}`);

    if (request?.systemPrompt) {
        formattedMessages.unshift({
            id: crypto.randomUUID(),
            role: "system",
            content: request.systemPrompt,
        });
    }

    const params = {
        messages: formattedMessages,
        instructions: request?.systemPrompt,
        system: request?.systemPrompt,
        modelSettings: {
            maxTokens: request?.maxTokens,
            temperature: request?.temperature ?? undefined,
        },
        requestContext: {
            modelPreferences: request?.modelPreferences || undefined,
        },
        structuredOutput: {
            schema: request?._meta?.structuredOutput,
        },
        tools: { autoIncludeEnabled: false },
    };

    try {
        const response = await selectedAgent.rawAgent.generate(params);
        if (!response) {
            return {
                code: -1,
                message: "Failed to generate response for sampling success response.",
            };
        }

        const finalMessage: IoAiWeb.SamplingSuccessResponse = {
            role: "assistant",
            content: { type: "text", text: response.text ?? "" },
            model: selectedAgent.modelId ?? "unknown",
            stopReason: "endTurn",
        };

        log.info(`Generated response for sampling success: ${safeStringify(finalMessage)}`);
        return finalMessage;
    } catch (error) {
        log.error(`Failed to generate sampling response: ${error instanceof Error ? error.message : String(error)}`);
        return { code: -1, message: "Failed to generate sampling response." };
    }
}
