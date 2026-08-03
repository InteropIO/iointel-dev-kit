import React, { useEffect } from "react";

import { ActivePanelModal } from "./ActivePanelModal";
import { AiDisclaimer } from "./AiDisclaimer";
import { ConfirmModal } from "./ConfirmModal";
import { WelcomeHeading } from "./WelcomeHeading";
import { useIoAssistStore, useIoAssistDynamicConfig } from "../../context/IoAssistContext";
import { useIoAiWebApi } from "../../hooks/useIoAiWebApi";
import { useIsMobileViewport } from "../../hooks/useIsMobileViewport";
import { MESSAGES_LOADING_STATE } from "../../types/loading";
import { Header } from "../header/Header";
import { InputArea } from "../input-area/InputArea";
import { MessageArea } from "../messages/MessageArea";
import { FavoritePromptList } from "../prompt/FavoritePromptList";
import { ThreadHistoryPanel } from "../threads/ThreadHistoryPanel";

export const Chat: React.FC = () => {
    const dynamicConfig = useIoAssistDynamicConfig();
    const isThreadHistoryVisible = useIoAssistStore((s) => s.isThreadHistoryVisible);
    const setIsThreadHistoryVisible = useIoAssistStore((s) => s.setIsThreadHistoryVisible);
    const messages = useIoAssistStore((s) => s.messages);
    const messageLoadingState = useIoAssistStore((s) => s.messageLoadingState);
    const favoritePromptNames = useIoAssistStore((s) => s.favoritePromptNames);

    const { sendMessage, abortMessage } = useIoAiWebApi();

    const isMobile = useIsMobileViewport();

    const hasMessages = messages.length > 0;
    const isLoadingThread = messageLoadingState.type === MESSAGES_LOADING_STATE.LOADING_FROM_THREAD;
    const showMessageArea = hasMessages || isLoadingThread;
    const showWelcomeMessage = !showMessageArea;
    const showFavoritePrompts = showWelcomeMessage && favoritePromptNames.length > 0;
    const agentName = dynamicConfig.user.name ?? dynamicConfig.user.id;

    // Auto-close sidebar when the viewport shrinks below md (parity with ng's
    // ResponsiveUIService effect). Intentionally depends only on `isMobile` so
    // it fires on the false→true transition; including `isThreadHistoryVisible`
    // would race the Header's open action and slam it shut on mobile.
    useEffect(() => {
        if (isMobile) {
            setIsThreadHistoryVisible(false);
        }
    }, [isMobile, setIsThreadHistoryVisible]);

    const handleSend = (text: string): void => {
        sendMessage(text);
    };

    const handleReload = (userQueryId: string): void => {
        const userMessage = messages.find((m) => m.id === userQueryId && m.role === "user");
        if (userMessage && typeof userMessage.content === "string" && userMessage.content.trim()) {
            sendMessage(userMessage.content);
        }
    };

    const closeSidebar = (): void => setIsThreadHistoryVisible(false);

    const scrollableClassNames = [
        "flex flex-col flex-1 min-h-0 min-w-0 pb-0 w-full overflow-x-hidden overflow-y-auto",
        "custom-scrollbar",
        showMessageArea ? "pt-0 gap-0" : "pt-24 md:pt-20 gap-12 md:gap-14",
    ].join(" ");

    const innerColumnClassNames = ["flex flex-1 min-h-0 min-w-0 flex-col items-center w-full custom-scrollbar-snap-right", showMessageArea ? "gap-0" : "gap-6"].join(" ");

    return (
        <div data-testid="io-assist-root" className="flex h-full w-full overflow-hidden bg-app-background">
            <div data-testid="chat" className="flex flex-1 min-h-0 overflow-hidden">
                {isThreadHistoryVisible && isMobile && (
                    <div role="presentation" className="fixed inset-0 z-20 bg-black/45" onClick={closeSidebar} onKeyDown={(e) => e.key === "Escape" && closeSidebar()} />
                )}

                {isThreadHistoryVisible && <ThreadHistoryPanel userName={dynamicConfig.user.name} className={isMobile ? "fixed left-0 top-0 h-full z-30" : "relative h-full shrink-0"} />}

                <div className="flex flex-col flex-1 min-h-0 min-w-0 items-center justify-end relative">
                    <Header />

                    <div className={scrollableClassNames}>
                        {showWelcomeMessage && <WelcomeHeading agentName={agentName} />}

                        <div className={innerColumnClassNames}>
                            {showMessageArea && <MessageArea onReloadResponse={handleReload} className="flex-1 flex flex-col min-h-0 min-w-0 w-full" />}

                            <InputArea onSend={handleSend} onAbort={abortMessage} className="max-w-[920px] md:max-w-[720px] w-full px-4" />

                            {showFavoritePrompts && <FavoritePromptList />}

                            <AiDisclaimer showMessageArea={showMessageArea} />
                        </div>
                    </div>
                </div>
            </div>

            <ActivePanelModal />
            <ConfirmModal />
        </div>
    );
};
