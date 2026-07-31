import React from "react";

import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";
import { MdFormatter } from "../messages/MdFormatter";
import { textToJSONMarkdown } from "../messages/mdUtils";
import { Icon } from "../shared/Icon";
import { InfoIcon } from "../shared/icons";

export const WorkingContextPanel: React.FC = () => {
    const workingContext = useIoAssistStore((s) => s.workingContext);

    return (
        <div data-testid="working-context-panel" className="working-context-panel flex flex-1 flex-col p-4 gap-4">
            <div className="flex items-center gap-2 mb-4 p-4 bg-app-background-secondary border border-border-default rounded">
                <Icon size={20} className="text-app-accent-color-1 shrink-0">
                    <InfoIcon />
                </Icon>
                <p className="text-sm text-proto-text-default">{UI_STRINGS.WORKING_CONTEXT_PANEL.DESCRIPTION}</p>
            </div>

            <MdFormatter content={textToJSONMarkdown(workingContext ?? {})} />
        </div>
    );
};
