import React from "react";

import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";
import { PANEL_CONTENT } from "../../types/panel";
import { PromptListPanel } from "../prompt/PromptListPanel";
import { Modal } from "../shared/Modal";
import { ToolListPanel } from "../tool/ToolListPanel";
import { WorkingContextPanel } from "../working-context-panel/WorkingContextPanel";

/**
 * Renders the currently-active panel (working-context / prompts / tools) inside
 * a centered modal. Mirrors the io-assist-ng OverlayService + AppPanel pattern.
 */
export const ActivePanelModal: React.FC = () => {
    const activePanelContent = useIoAssistStore((s) => s.activePanelContent);
    const setActivePanelContent = useIoAssistStore((s) => s.setActivePanelContent);

    if (!activePanelContent) return null;

    const title =
        activePanelContent === PANEL_CONTENT.WORKING_CONTEXT
            ? UI_STRINGS.WORKING_CONTEXT_PANEL.TITLE
            : activePanelContent === PANEL_CONTENT.PROMPTS
              ? UI_STRINGS.PROMPT_LIST_COMPONENT.AVAILABLE_PROMPTS
              : UI_STRINGS.TOOL_LIST_COMPONENT.AVAILABLE_TOOLS;

    const close = () => setActivePanelContent(null);

    const description = activePanelContent === PANEL_CONTENT.WORKING_CONTEXT ? UI_STRINGS.WORKING_CONTEXT_PANEL_COMPONENT.SUBTITLE : undefined;

    const isContentSelfScrolling = activePanelContent === PANEL_CONTENT.PROMPTS || activePanelContent === PANEL_CONTENT.TOOLS;
    const fixedHeight = activePanelContent === PANEL_CONTENT.TOOLS ? "440px" : undefined;

    const footer =
        activePanelContent === PANEL_CONTENT.WORKING_CONTEXT ? (
            <button
                type="button"
                data-testid="working-context-cancel-button"
                onClick={close}
                className="app-button flex justify-center items-center rounded-sm cursor-pointer gap-1 px-spacing-6 py-spacing-3 border border-border-default text-text-default hover:text-text-states-active hover:border-border-hover transition-colors"
            >
                {UI_STRINGS.GENERAL.CANCEL}
            </button>
        ) : null;

    return (
        <Modal
            open
            onClose={close}
            title={title}
            description={description}
            showCloseIcon
            footer={footer}
            testId="active-panel-modal"
            isContentSelfScrolling={isContentSelfScrolling}
            fixedHeight={fixedHeight}
        >
            {activePanelContent === PANEL_CONTENT.WORKING_CONTEXT && <WorkingContextPanel />}
            {activePanelContent === PANEL_CONTENT.PROMPTS && <PromptListPanel />}
            {activePanelContent === PANEL_CONTENT.TOOLS && <ToolListPanel />}
        </Modal>
    );
};
