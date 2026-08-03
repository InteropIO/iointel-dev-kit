import React from "react";

import { MdFormatter } from "./MdFormatter";
import { MessageFooter } from "./MessageFooter";
import type { UIAssistantMessage } from "../../types";

type Props = {
    message: UIAssistantMessage;
    showFooter?: boolean;
    /** Aggregated response text for the footer's copy button. */
    footerCopyText?: string;
    onReload?: () => void;
    isGenerating?: boolean;
};

export const AssistantMessage: React.FC<Props> = ({ message, showFooter = false, footerCopyText = "", onReload, isGenerating = false }) => {
    return (
        <div data-testid="assistant-message" className="flex flex-col flex-1 min-w-0 max-w-full self-stretch text-text-states-active font-weight-weight-400 leading-[19px] safe-word-break">
            {message.content && (
                <div data-testid="assistant-message-text">
                    <MdFormatter content={message.content} />
                </div>
            )}

            {showFooter && <MessageFooter copyText={footerCopyText} onReload={onReload} isGenerating={isGenerating} />}
        </div>
    );
};
