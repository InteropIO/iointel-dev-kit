import type { IoAiWeb } from "@interopio/ai-web";
import React, { useRef } from "react";

import { AssistantMessage } from "./AssistantMessage";
import { McpAppResource } from "./McpAppResource";
import { ToolTraceMessage } from "./ToolTraceMessage";
import { UserMessage } from "./UserMessage";
import { useIoAssistStore } from "../../context/IoAssistContext";
import { MESSAGES_LOADING_STATE } from "../../types/loading";
import { UI_MESSAGE_ROLES } from "../../types/message";
import { RESPONSE_STREAM_STATUS } from "../../types/stream";
import { buildRenderList, computeFooterHosts, responseToText } from "../../utils/messageUtils";
import { ScrollArea } from "../scroll-area/ScrollArea";

type Props = {
    onReloadResponse: (userQueryId: string) => void;
    className?: string;
};

export const MessageArea: React.FC<Props> = ({ onReloadResponse, className }) => {
    const messages = useIoAssistStore((s) => s.messages);
    const toolTraceState = useIoAssistStore((s) => s.toolTraceState);
    const isGenerating = useIoAssistStore((s) => {
        const id = s.activeThreadId;
        return !!id && s.streamsByThreadId[id]?.status === RESPONSE_STREAM_STATUS.STREAMING;
    });
    const messageLoadingState = useIoAssistStore((s) => s.messageLoadingState);
    const mcpAppInstances = useIoAssistStore((s) => s.mcpAppInstances);
    const activeThreadId = useIoAssistStore((s) => s.activeThreadId);
    const toggleToolTrace = useIoAssistStore((s) => s.toggleToolTrace);
    const toggleToolMessage = useIoAssistStore((s) => s.toggleToolMessage);
    const scrollAnchorRequestId = useIoAssistStore((s) => s.scrollAnchorRequestId);
    const messageListRef = useRef<HTMLDivElement>(null);

    const visibleMcpApps = mcpAppInstances.filter((app: IoAiWeb.McpApps.AppInstance) => {
        if (app.displayMode === "workspace") return false;
        return !activeThreadId || !app.threadId || app.threadId === activeThreadId;
    });

    const renderedMessages = buildRenderList(messages, toolTraceState, visibleMcpApps);

    // Where each response's single footer belongs (assistant tail vs trailing
    // tool-trace), one per response group, like ng.
    const footerHosts = computeFooterHosts(renderedMessages);

    const lastMessage = messages[messages.length - 1];
    const isLastUser = lastMessage?.role === UI_MESSAGE_ROLES.USER;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === UI_MESSAGE_ROLES.USER);

    const isSuccessFetchedFromThread = messageLoadingState.type === MESSAGES_LOADING_STATE.FETCH_MESSAGES_FROM_THREAD_SUCCESS;
    // Loading error is attached to the last user message — the reload button + error text render
    // there, matching ng's UserMessageComponent.
    const loadingError = messageLoadingState.type === MESSAGES_LOADING_STATE.ERROR ? messageLoadingState.message : undefined;

    // The response currently being generated shows no footer until it settles — mirrors ng,
    // where `displayFooter` is only set on getResponseSuccess / abortResponseGeneration, never
    // mid-stream. When generation ends (including a user stop), `isGenerating` flips to false
    // and the footer appears with copy + reload. Older responses keep their footers throughout.
    const streamingResponseUserId = isGenerating ? lastUserMessage?.id : undefined;

    return (
        <ScrollArea
            shouldExpandSpacer={isLastUser}
            isForceScrollToBottomEnabled={isSuccessFetchedFromThread}
            snapToTopTrigger={scrollAnchorRequestId}
            observeRef={messageListRef}
            className={className}
        >
            {messageLoadingState.type === MESSAGES_LOADING_STATE.LOADING_FROM_THREAD && (
                <div className="flex flex-1 justify-center items-center p-4">
                    <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="size-1.5 rounded-full bg-app-accent-color-1"
                                style={{
                                    animationDelay: `${i * 0.15}s`,
                                    animation: `rise 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.15}s infinite alternate`,
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}

            <div ref={messageListRef} data-testid="message-list" className="flex flex-1 flex-col gap-8 w-full min-w-[200px] max-w-[920px] md:max-w-[720px] mx-auto px-3 [&>*:last-child]:pb-8">
                {renderedMessages.map((item) => {
                    if (item.type === "user") {
                        const isLast = isGenerating ? item.message.id === lastUserMessage?.id : item.message.id === lastMessage?.id && isLastUser;
                        const isLastUserMessage = item.message.id === lastUserMessage?.id;
                        const error = isLastUserMessage ? loadingError : undefined;
                        return (
                            <UserMessage key={item.message.id} message={item.message} isLast={isLast} isGenerating={isGenerating} error={error} onReload={() => onReloadResponse(item.message.id)} />
                        );
                    }

                    if (item.type === "assistant") {
                        const userQueryId = footerHosts.assistant.get(item.message.id);
                        const showFooter = !!userQueryId && userQueryId !== streamingResponseUserId;
                        return (
                            <AssistantMessage
                                key={item.message.id}
                                message={item.message}
                                showFooter={showFooter}
                                footerCopyText={userQueryId ? responseToText(messages, userQueryId) : ""}
                                isGenerating={isGenerating}
                                onReload={userQueryId ? () => onReloadResponse(userQueryId) : undefined}
                            />
                        );
                    }

                    if (item.type === "tool-trace") {
                        const userQueryId = footerHosts.trace.get(item.trace.stateForMessageId);
                        const showFooter = !!userQueryId && userQueryId !== streamingResponseUserId;
                        return (
                            <ToolTraceMessage
                                key={`trace-${item.trace.stateForMessageId}`}
                                trace={item.trace}
                                onToggle={toggleToolTrace}
                                onToggleTool={toggleToolMessage}
                                showFooter={showFooter}
                                footerCopyText={userQueryId ? responseToText(messages, userQueryId) : ""}
                                isGenerating={isGenerating}
                                onReload={userQueryId ? () => onReloadResponse(userQueryId) : undefined}
                            />
                        );
                    }

                    if (item.type === "mcp-app") {
                        return <McpAppResource key={item.app.id} appInstance={item.app} />;
                    }

                    return null;
                })}
            </div>
        </ScrollArea>
    );
};
