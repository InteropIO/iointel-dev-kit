import React from "react";

import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";
import { useIoAiWebApi } from "../../hooks/useIoAiWebApi";
import { MESSAGES_LOADING_STATE } from "../../types/loading";
import { PANEL_CONTENT } from "../../types/panel";
import { Button } from "../shared/Button";
import { IconButton } from "../shared/IconButton";
import { HomeIcon, ThreadHistoryIcon } from "../shared/icons";
import { Tooltip } from "../shared/Tooltip";

export const Header: React.FC = () => {
    const isThreadHistoryVisible = useIoAssistStore((s) => s.isThreadHistoryVisible);
    const messagesLength = useIoAssistStore((s) => s.messages.length);
    const messageLoadingState = useIoAssistStore((s) => s.messageLoadingState);
    const completionNotifications = useIoAssistStore((s) => s.completionNotifications);
    const isWorkingContextEnabled = useIoAssistStore((s) => s.isWorkingContextEnabled);
    const setIsThreadHistoryVisible = useIoAssistStore((s) => s.setIsThreadHistoryVisible);
    const setActivePanelContent = useIoAssistStore((s) => s.setActivePanelContent);
    const { newConversation } = useIoAiWebApi();

    const hasMessages = messagesLength > 0;
    const isMessageLoading = messageLoadingState.type === MESSAGES_LOADING_STATE.LOADING_RESPONSE || messageLoadingState.type === MESSAGES_LOADING_STATE.LOADING_FROM_THREAD;
    const hasNotification = completionNotifications.length > 0;
    const showThreadToggle = !isThreadHistoryVisible;
    const showHomeButton = isMessageLoading || hasMessages;

    const handleShowThreadHistory = () => {
        setIsThreadHistoryVisible(true);
    };

    const handleNewConversation = () => {
        void newConversation();
    };

    const handleWorkingContextOpen = () => {
        setActivePanelContent(PANEL_CONTENT.WORKING_CONTEXT);
    };

    return (
        <div data-testid="header" className="flex w-full items-center justify-start px-4 py-2 gap-2">
            {showThreadToggle || showHomeButton ? (
                <div className="flex gap-1">
                    {showThreadToggle && (
                        <div className="relative">
                            <IconButton
                                size={12}
                                containerSize={24}
                                shape="rounded-square"
                                hoverFill
                                testId="thread-toggle-button"
                                onClick={handleShowThreadHistory}
                                title="Thread History"
                            >
                                <ThreadHistoryIcon />
                            </IconButton>
                            {hasNotification && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-orange-500" />}
                        </div>
                    )}

                    {showHomeButton && (
                        <Tooltip position="bottom" content={UI_STRINGS.HEADER_COMPONENT.HOME_TOOLTIP}>
                            <IconButton
                                size={12}
                                containerSize={24}
                                shape="rounded-square"
                                hoverFill
                                testId="home-button"
                                onClick={handleNewConversation}
                                title="Home"
                                aria-label={UI_STRINGS.HEADER_COMPONENT.HOME_TOOLTIP}
                            >
                                <HomeIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </div>
            ) : null}

            {isWorkingContextEnabled && (
                <Tooltip position="bottom" content={<span className="max-w-[260px] text-wrap text-xs">{UI_STRINGS.HEADER_COMPONENT.CONTEXT_TOOLTIP}</span>}>
                    <Button buttonType="secondary" size="small" testId="working-context-button" onClick={handleWorkingContextOpen}>
                        {UI_STRINGS.WORKING_CONTEXT_PANEL_COMPONENT.VIEW_WORKING_CONTEXT_BUTTON}
                    </Button>
                </Tooltip>
            )}
        </div>
    );
};
