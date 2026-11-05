import React from "react";

import type { UIUserMessage } from "../../types";
import { CopyButton } from "../shared/CopyButton";
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
        <div data-testid="user-message" className="group flex flex-col justify-end">
            <div className="flex items-end justify-end">
                <div className="flex items-end px-2">
                    {showSpinner && (
                        <span data-testid="loading-indicator" className="inline-flex">
                            <Spinner className="size-5" />
                        </span>
                    )}

                    {showReloadButton && <ReloadButton testId="user-message-regenerate-button" onClick={onReload} size={16} className="size-8" />}
                </div>

                <div className="flex flex-col items-end min-w-0 pt-4">
                    <div className="list-none text-[13px] leading-[18px] font-weight-350 text-user-message-text bg-user-message-background max-w-[620px] min-w-0 whitespace-pre-wrap break-words rounded-lg py-3 px-4">
                        {message.content ?? ""}
                    </div>
                </div>
            </div>

            <div className="flex justify-end mt-0.5 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                <CopyButton textToCopy={message.content ?? ""} testId="user-message-copy-button" />
            </div>

            {showError && <div className="flex justify-end py-1 text-text-default text-[13px] font-weight-350 leading-[100%]">{error}</div>}
        </div>
    );
};
