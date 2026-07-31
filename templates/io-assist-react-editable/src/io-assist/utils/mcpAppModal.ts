import { showConfirmModal, MODAL_PREEMPTED } from "./confirmModal";
import { isModalsAvailable, requestModalDialog } from "./ioModals";
import { logger } from "./logger";
import { UI_STRINGS } from "../constants/uiStrings";

const LOGGER_NAME = "McpAppsModal";
const log = logger.get(LOGGER_NAME);

type ReplaceChoice = "recreate" | "newInstance";

export async function showMcpAppReplaceModal(toolName: string): Promise<ReplaceChoice> {
    try {
        const modalsAvailable = await isModalsAvailable();
        return modalsAvailable ? await getModalsApiResponse(toolName) : await getBuiltInPanelResponse(toolName);
    } catch (error) {
        log.warn(`MCP app replace modal failed, defaulting to recreate: ${error instanceof Error ? error.message : String(error)}`);
        return "recreate";
    }
}

async function getModalsApiResponse(toolName: string): Promise<ReplaceChoice> {
    const strings = UI_STRINGS.MCP_APP_REPLACE_MODAL;
    const response = await requestModalDialog({
        templateName: "noInputsConfirmationDialog",
        variables: {
            title: strings.TITLE,
            heading: strings.HEADING,
            text: strings.TEXT(toolName),
            actionButtons: [
                { variant: "primary", text: strings.REPLACE_BUTTON, id: "replace" },
                { variant: "outline", text: strings.NEW_INSTANCE_BUTTON, id: "new" },
            ],
        },
    });
    return response?.responseButtonClicked?.id === "replace" ? "recreate" : "newInstance";
}

async function getBuiltInPanelResponse(toolName: string): Promise<ReplaceChoice> {
    const strings = UI_STRINGS.MCP_APP_REPLACE_MODAL;
    const buttonId = await showConfirmModal({
        title: strings.TITLE,
        heading: strings.HEADING,
        text: strings.TEXT(toolName),
        buttons: [
            { id: "replace", label: strings.REPLACE_BUTTON, variant: "primary" },
            { id: "new", label: strings.NEW_INSTANCE_BUTTON, variant: "default" },
        ],
    });
    if (buttonId === MODAL_PREEMPTED) {
        log.warn(`MCP app replace modal for "${toolName}" was preempted by another modal; defaulting to recreate.`);
        return "recreate";
    }
    return buttonId === "replace" ? "recreate" : "newInstance";
}
