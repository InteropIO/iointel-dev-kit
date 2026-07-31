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

    return (
        <Modal open onClose={close} title={title} showCloseIcon testId="active-panel-modal">
            <div className="px-3 pb-6">
                {activePanelContent === PANEL_CONTENT.WORKING_CONTEXT && <WorkingContextPanel />}
                {activePanelContent === PANEL_CONTENT.PROMPTS && <PromptListPanel />}
                {activePanelContent === PANEL_CONTENT.TOOLS && <ToolListPanel />}
            </div>
        </Modal>
    );
};
