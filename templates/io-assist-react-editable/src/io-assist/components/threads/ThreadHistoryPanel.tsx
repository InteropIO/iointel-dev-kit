import React from "react";

import { ThreadHistory } from "./ThreadHistory";
import { useIoAssistStore } from "../../context/IoAssistContext";
import { IconButton } from "../shared/IconButton";
import { ThreadHistoryIcon } from "../shared/icons";
import { IoAssistLogoDark, IoAssistLogoLight } from "../shared/icons";

type ThreadHistoryPanelProps = {
    userName?: string;
    className?: string;
};

export const ThreadHistoryPanel: React.FC<ThreadHistoryPanelProps> = ({ userName, className }) => {
    const setIsThreadHistoryVisible = useIoAssistStore((s) => s.setIsThreadHistoryVisible);
    const isDarkMode = useIoAssistStore((s) => s.isDarkMode);

    const hideThreadHistory = () => setIsThreadHistoryVisible(false);

    const userInitial = userName ? userName.charAt(0).toUpperCase() : "U";
    const hasUsername = !!userName;

    return (
        <aside data-testid="thread-history-panel" className={["flex flex-col h-full w-full md:w-[368px] md:min-w-[368px] md:max-w-[368px] bg-app-background-secondary", className ?? ""].join(" ")}>
            <div className="flex items-center gap-4 px-4 py-2">
                <IconButton size={12} containerSize={24} onClick={hideThreadHistory} title="Thread history">
                    <ThreadHistoryIcon />
                </IconButton>
                {isDarkMode ? <IoAssistLogoDark /> : <IoAssistLogoLight />}
            </div>

            <ThreadHistory />

            {hasUsername && (
                <div data-testid="thread-user-profile" className="flex items-center gap-3 px-4 py-3 mt-auto border-t border-border-default">
                    <div data-testid="thread-user-avatar" className="flex items-center justify-center size-6 rounded-full bg-app-accent-color-1 text-white font-semibold text-[12px] flex-shrink-0">
                        {userInitial}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span data-testid="thread-user-name" className="text-text-default text-[12px] leading-[12px] font-normal truncate" title={userName}>
                            {userName}
                        </span>
                    </div>
                </div>
            )}
        </aside>
    );
};
