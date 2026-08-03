import React from "react";

import type { UIUserMessage } from "../../types";
import { Spinner } from "../shared/icons";
import { ReloadButton } from "../shared/ReloadButton";

type Props = {
    message: UIUserMessage;
    isLast?: boolean;
    isGenerating?: boolean;
    /** Loading-error text for the last user message; shows the error + reload button (mirrors ng). */
    error?: string;
    /** Regenerate the response for this user message. */
    onReload?: () => void;
};

export const UserMessage: React.FC<Props> = ({ message, isLast = false, isGenerating = false, error, onReload }) => {
    const showSpinner = isLast && isGenerating;
    const showError = !!error;
    const showReloadButton = !!error && !!onReload;

    return (
        <div data-testid="user-message" className="flex flex-col justify-end">
            <div className="flex items-end justify-end">
                <div className="flex items-end px-2">
                    {showSpinner && (
                        <span data-testid="loading-indicator" className="inline-flex">
                            <Spinner className="size-5" />
                        </span>
                    )}

                    {showReloadButton && <ReloadButton testId="user-message-regenerate-button" onClick={onReload} size={16} className="size-8" />}
                </div>

                <div className="flex min-w-0">
                    <div className="p-4 list-none text-[14px] leading-[18px] font-weight-weight-400 text-user-message-text bg-user-message-background rounded-2xl max-w-[620px] min-w-0 whitespace-pre-wrap break-words">
                        {message.content ?? ""}
                    </div>
                </div>
            </div>

            {showError && <div className="flex justify-end py-1 text-text-default text-[13px] font-weight-weight-400 leading-[100%]">{error}</div>}
        </div>
    );
};
