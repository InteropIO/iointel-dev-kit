import React from "react";

import { UI_STRINGS } from "../../constants/uiStrings";
import { CopyButton } from "../shared/CopyButton";
import { ReloadButton } from "../shared/ReloadButton";
import { Tooltip } from "../shared/Tooltip";

type Props = {
    /** Aggregated response text the copy button writes to the clipboard. */
    copyText: string;
    /** Regenerate the response. Omit to hide the reload button. */
    onReload?: () => void;
    /** Disables reload (and shows its tooltip) while a response is streaming. */
    isGenerating?: boolean;
};

/**
 * Footer shown once per response (mirrors ng's MessageFooterComponent). Rendered
 * by both `AssistantMessage` (text responses) and `ToolTraceMessage` (responses
 * that end in a tool call). The copy button writes the whole response, and reload
 * regenerates it.
 */
export const MessageFooter: React.FC<Props> = ({ copyText, onReload, isGenerating = false }) => (
    <div data-testid="message-footer" className="flex flex-1 gap-[2px] items-center pt-2 text-text-secondary">
        <CopyButton textToCopy={copyText} testId="message-footer-copy-button" className="size-6" />
        {onReload && (
            <Tooltip position="top" offset={6} disabled={!isGenerating} content={UI_STRINGS.MESSAGE_FOOTER_COMPONENT.RELOAD_DISABLED_TOOLTIP}>
                <ReloadButton testId="message-footer-regenerate-button" onClick={onReload} disabled={isGenerating} className="size-6" />
            </Tooltip>
        )}
    </div>
);
