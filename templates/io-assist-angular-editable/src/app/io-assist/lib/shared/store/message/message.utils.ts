/* eslint-disable @typescript-eslint/no-explicit-any */ // TODO: Remove this line after fixing any 'any' types
import { IoAiWeb } from "@interopio/ai-web";
import { IOConnectCore } from "@interopio/core";
import { of, Observable } from "rxjs";

import { addAssistantMessage, addToolCall, addToolResult, getResponseFailure, getResponseSuccess, updateToolCallArgs } from "./message.actions";
import { MessageReducerStateType } from "./message.reducer";
import { TOOL_RESULT_TYPES, ToolResult, ToolTraceState, UI_MESSAGE_ROLES, UIMessage, UIToolMessage } from "./types";
import { abortThreadStream, addStreamToolMessage, completeThreadStream, updateStreamContent } from "../response-stream/response-stream.actions";

type ToolCallStreamState = {
    args: string;
    toolName?: string;
};

/**
 * Processes AG-UI events from a StreamResponse (RunHandle) and converts them into Redux actions.
 * Thread-aware - each action includes the threadId for proper filtering in reducer.
 * Also emits stream management actions for response-stream state.
 *
 * Key behaviors:
 * - TEXT_MESSAGE_START: Creates assistant message placeholder (active thread) or skips (background)
 * - TEXT_MESSAGE_CONTENT: Accumulates and dispatches full content (reducer expects full replacement)
 * - TOOL_CALL_START: Creates tool message with empty args
 * - TOOL_CALL_ARGS: Accumulates streaming JSON deltas for tool arguments
 * - TOOL_CALL_END: Parses accumulated args and updates tool message
 * - TOOL_CALL_RESULT: Dispatches tool result
 * - abort(): Signals stream cancellation without treating it as success
 * - complete(): Signals stream completion with getResponseSuccess
 * - error(): Signals stream failure
 *
 * Completion is signaled only via the subscribe complete() callback, NOT on RUN_FINISHED events,
 * because RUN_FINISHED is intermediate during multi-turn tool loops.
 *
 * @param runHandle - AG-UI StreamResponse with subscribe/abort methods
 * @param threadId - The thread ID this stream belongs to
 * @param isStreamingOnBackgroundThread - Function that returns true if streaming on a background thread
 * @returns Observable emitting Redux actions for message state and stream state updates
 */
export const handleResponseStream = (runHandle: IoAiWeb.Agents.StreamResponse, threadId: string, isStreamingOnBackgroundThread: () => boolean, logger: IOConnectCore.Logger.API): Observable<any> => {
    if (!runHandle || typeof runHandle.subscribe !== "function") {
        logger.error(`Invalid response object: ${JSON.stringify(runHandle)}`);
        return of(getResponseFailure({ error: new Error("Invalid response object"), threadId }));
    }

    return new Observable<any>((observer) => {
        let streamedContent = "";
        let currentMessageId = "";
        // Keep stream accumulation state scoped to this subscription.
        const toolCallArgsMap = new Map<string, ToolCallStreamState>();

        const subscription = runHandle.subscribe({
            next: (event: IoAiWeb.Agents.StreamEvent) => {
                switch (event.type) {
                    case "TEXT_MESSAGE_START": {
                        currentMessageId = (event as any).messageId || crypto.randomUUID();
                        streamedContent = "";

                        if (!isStreamingOnBackgroundThread()) {
                            observer.next(
                                addAssistantMessage({
                                    message: {
                                        id: currentMessageId,
                                        role: UI_MESSAGE_ROLES.ASSISTANT,
                                        content: "",
                                    },
                                    threadId,
                                })
                            );
                        }
                        break;
                    }

                    case "TEXT_MESSAGE_CONTENT": {
                        streamedContent += (event as any).delta || "";

                        if (isStreamingOnBackgroundThread()) {
                            observer.next(
                                updateStreamContent({
                                    threadId,
                                    content: streamedContent,
                                    messageId: currentMessageId,
                                })
                            );
                            return;
                        }

                        observer.next(
                            addAssistantMessage({
                                message: {
                                    id: currentMessageId,
                                    role: UI_MESSAGE_ROLES.ASSISTANT,
                                    content: streamedContent,
                                },
                                threadId,
                            })
                        );
                        break;
                    }

                    case "TEXT_MESSAGE_END":
                        break;

                    case "TOOL_CALL_START": {
                        // Text segment ended, reset content tracking
                        streamedContent = "";

                        const toolMessage: UIToolMessage = {
                            id: (event as any).toolCallId || crypto.randomUUID(),
                            toolName: (event as any).toolCallName || "unknown",
                            args: {},
                            role: UI_MESSAGE_ROLES.TOOL,
                        };
                        toolCallArgsMap.set(toolMessage.id, {
                            args: "",
                            toolName: toolMessage.toolName,
                        });

                        if (isStreamingOnBackgroundThread()) {
                            observer.next(
                                addStreamToolMessage({
                                    threadId,
                                    toolMessage,
                                })
                            );
                            return;
                        }

                        observer.next(
                            addToolCall({
                                message: toolMessage,
                                threadId,
                            })
                        );
                        break;
                    }

                    case "TOOL_CALL_ARGS": {
                        const toolCallId = (event as any).toolCallId || "";
                        const delta = (event as any).delta;

                        if (!toolCallId) {
                            logger.error("Something went wrong. Missing or empty tool call id.");
                            return;
                        }

                        // Accumulate the args delta for this tool call
                        const currentToolCallState = toolCallArgsMap.get(toolCallId) || {
                            args: "",
                        };
                        toolCallArgsMap.set(toolCallId, {
                            ...currentToolCallState,
                            args: currentToolCallState.args + delta,
                        });

                        break;
                    }
                    case "TOOL_CALL_END": {
                        const toolCallId = (event as any).toolCallId || "";

                        if (!toolCallId) {
                            logger.error("Something went wrong. Missing or empty tool call id.");
                            return;
                        }

                        // Parse accumulated args and dispatch update
                        const toolCallState = toolCallArgsMap.get(toolCallId);
                        const accumulatedArgsStr = toolCallState?.args || "{}";
                        const toolName = toolCallState?.toolName || "unknown";
                        let parsedArgs: Record<string, unknown> = {};

                        try {
                            parsedArgs = JSON.parse(accumulatedArgsStr);
                        } catch (err) {
                            logger.error(`Failed to parse tool call args: ${accumulatedArgsStr}`, err instanceof Error ? err : new Error("Unknown error"));
                        }

                        // Clean up the map
                        toolCallArgsMap.delete(toolCallId);

                        if (isStreamingOnBackgroundThread()) {
                            // For background threads, update the tool message in stream state
                            observer.next(
                                addStreamToolMessage({
                                    threadId,
                                    toolMessage: {
                                        id: toolCallId,
                                        toolName,
                                        args: parsedArgs,
                                        role: UI_MESSAGE_ROLES.TOOL,
                                    },
                                })
                            );
                            return;
                        }

                        // Dispatch action to update the tool message with parsed args
                        observer.next(
                            updateToolCallArgs({
                                toolCallId,
                                args: parsedArgs,
                                threadId,
                            })
                        );
                        break;
                    }

                    case "TOOL_CALL_RESULT": {
                        const toolCallId = (event as any).toolCallId || "";
                        let result: any = (event as any).content;

                        if (!toolCallId) {
                            logger.error("Something went wrong. Missing or empty tool call id.");

                            return;
                        }

                        if (typeof result === "string") {
                            try {
                                result = JSON.parse(result);
                            } catch (err) {
                                logger.error(`Failed to parse tool call result: ${result}`, err instanceof Error ? err : new Error("Unknown error"));

                                result = {
                                    type: TOOL_RESULT_TYPES.TEXT,
                                    text: result,
                                };
                            }
                        }

                        if (isStreamingOnBackgroundThread()) {
                            const toolName = toolCallArgsMap.get(toolCallId)?.toolName || "unknown";
                            observer.next(
                                addStreamToolMessage({
                                    threadId,
                                    toolMessage: {
                                        id: toolCallId,
                                        toolName,
                                        args: {},
                                        result,
                                        role: UI_MESSAGE_ROLES.TOOL,
                                    },
                                })
                            );
                            return;
                        }

                        observer.next(
                            addToolResult({
                                toolCallId,
                                result,
                                threadId,
                            })
                        );
                        break;
                    }

                    case "RUN_STARTED":
                    case "RUN_FINISHED":
                    case "STEP_STARTED":
                    case "STEP_FINISHED":
                        break;

                    case "RUN_ERROR":
                        logger.error("Run error:", (event as any).message);
                        break;

                    default:
                        logger.warn(`Unknown AG-UI event type: ${event.type}`);
                        break;
                }
            },

            error: (err: Error) => {
                logger.error("Stream error:", err);

                if (isStreamingOnBackgroundThread()) {
                    observer.next(
                        completeThreadStream({
                            threadId,
                            shouldNotify: true,
                        })
                    );
                } else {
                    observer.next(
                        getResponseFailure({
                            error: err,
                            threadId,
                        })
                    );
                }

                observer.complete();
            },

            abort: () => {
                observer.next(abortThreadStream({ threadId }));
                observer.complete();
            },

            complete: () => {
                observer.next(
                    completeThreadStream({
                        threadId,
                        shouldNotify: isStreamingOnBackgroundThread(),
                    })
                );

                observer.next(getResponseSuccess({ threadId }));

                observer.complete();
            },
        });

        // Teardown: unsubscribe from AG-UI stream when Observable is unsubscribed
        return () => {
            toolCallArgsMap.clear();
            subscription.unsubscribe();
        };
    });
};

/**
 * Utility function to construct message state when messages come in bulk.
 * Usually when fetching messages from a thread.
 *
 * @param messages - Array of UIMessage to update fields for
 * @param shouldSetDisplayFooter - Whether to set the displayFooter field
 * @param shouldSetResponseForUserQueryId - Whether to set the responseForUserQueryId field
 *
 * @returns Updated array of UIMessage
 */
export const updateMessageFields = (messages: UIMessage[], shouldSetDisplayFooter: boolean, shouldSetResponseForUserQueryId?: boolean): UIMessage[] => {
    let lastUserMessageId: string | undefined = undefined;

    return messages.map((msg: UIMessage, msgIndex: number) => {
        if (msg.role === UI_MESSAGE_ROLES.USER) {
            lastUserMessageId = msg.id;
        }

        const nextMessage: UIMessage | undefined = messages[msgIndex + 1];

        const isLastMessage: boolean = msgIndex === messages.length - 1;
        const isNextMessageUser: boolean = !!nextMessage && nextMessage.role === UI_MESSAGE_ROLES.USER;

        return {
            ...msg,
            displayFooter: shouldSetDisplayFooter ? isLastMessage || isNextMessageUser : msg.displayFooter,
            responseForUserQueryId: shouldSetResponseForUserQueryId ? lastUserMessageId : msg.responseForUserQueryId,
            // Add other fields to update as needed
        };
    });
};

/**
 * Function to get the response text for a given user message ID.
 *
 * A response is considered all messages that the user message has triggered,
 * including assistant messages and tool messages until another user message is found.
 *
 * @param userQueryId - ID of the user message to get the response for
 * @returns response text corresponding to the user message ID
 */
export const responseToText = (messages: UIMessage[], userQueryId: string): string => {
    const stringResponse = messages
        .filter((message) => message.role !== UI_MESSAGE_ROLES.USER && message.responseForUserQueryId === userQueryId)
        .map((message) => {
            switch (message.role) {
                case UI_MESSAGE_ROLES.ASSISTANT:
                    return message.content || "";
                case UI_MESSAGE_ROLES.TOOL:
                    return `Tool (${message.toolName}) input: ${JSON.stringify(message.args || "")} result: ${JSON.stringify(message.result || "")}`;
                default:
                    return "";
            }
        })
        .join("\n");

    return stringResponse;
};

/**
 * We should also render the footer on responses that end with tool messages (tool-trace messages in our UI context) if that is the case.
 */
export const setDisplayFooterOnLastTrace = (toolTraceState: ToolTraceState[], messages: UIMessage[]): ToolTraceState[] => {
    if (toolTraceState.length === 0 || messages.length === 0) {
        return toolTraceState;
    }

    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role !== UI_MESSAGE_ROLES.TOOL) {
        return toolTraceState;
    }

    return toolTraceState.map((trace, index) => {
        if (index === toolTraceState.length - 1) {
            return { ...trace, displayFooter: true };
        }
        return trace;
    });
};

/**
 * Function to add a tool trace call entry to the tool trace state array.
 *
 * @param state - Current MessageReducerStateType
 * @param currentTool - The tool message to add
 *
 * @returns Updated array of ToolTraceState
 */
export const addToolTraceCallEntry = (state: MessageReducerStateType, currentTool: UIToolMessage): ToolTraceState[] => {
    const messages: UIMessage[] = state.messages;
    const toolTraceState: ToolTraceState[] = state.toolTraceState;

    // Find the last message that is not a tool message so we can link the tool trace to it
    const reversedMessages: UIMessage[] = messages.slice().reverse();
    const lastMessage = reversedMessages.find((msg: UIMessage) => msg.role !== UI_MESSAGE_ROLES.TOOL);

    if (!lastMessage) {
        // Normally we always have at least one non-tool message (the user message that triggered the tool calls)
        return toolTraceState;
    }

    const existingToolTraceIndex = state.toolTraceState.findIndex((state: ToolTraceState) => state.stateForMessageId === lastMessage?.id);

    if (existingToolTraceIndex !== -1) {
        return state.toolTraceState.map((state, index) => {
            const shouldUpdateExisting: boolean = index === existingToolTraceIndex;

            if (shouldUpdateExisting) {
                return {
                    ...state,
                    executedTools: [...state.executedTools, currentTool],
                    uiMessage: `Called tool: ${currentTool.toolName}`,
                };
            }

            return state;
        });
    }

    const ownerUserMessageId =
        messages
            .slice(0, messages.indexOf(lastMessage) + 1)
            .reverse()
            .find((m) => m.role === UI_MESSAGE_ROLES.USER)?.id ?? "";

    return toolTraceState.concat({
        stateForMessageId: lastMessage ? lastMessage.id : "",
        executedTools: [currentTool],
        uiMessage: `Called tool: ${currentTool.toolName}`,
        responseForUserQueryId: ownerUserMessageId,
    });
};

/**
 * Function to update tool call arguments in the tool trace state array.
 * This is called on each args delta during streaming to update the tool's args.
 *
 * @param state - Current array of ToolTraceState
 * @param toolCallId - ID of the tool call message
 * @param args - Arguments delta to merge into the tool call
 *
 * @returns Updated array of ToolTraceState
 */
export const updateToolTraceCallEntryArgs = (state: ToolTraceState[], toolCallId: string, args: Record<string, unknown>): ToolTraceState[] => {
    return state.map((traceState: ToolTraceState) => {
        const executedTools: UIToolMessage[] = traceState.executedTools;

        const matchingToolCall: UIToolMessage | undefined = executedTools.find((toolMsg: UIToolMessage) => toolMsg.id === toolCallId);

        if (!matchingToolCall) {
            return traceState;
        }

        const updatedToolCall = {
            ...matchingToolCall,
            args: { ...matchingToolCall.args, ...args },
        };

        return {
            ...traceState,
            executedTools: executedTools.map((toolMsg: UIToolMessage) => (toolMsg.id === toolCallId ? updatedToolCall : toolMsg)),
        };
    });
};

/**
 * Function to add a tool result to its corresponding tool call in the tool trace state array.
 *
 * @param state - Current array of ToolTraceState
 * @param toolCallId - ID of the tool call message
 * @param result - Result of the tool call
 *
 * @returns Updated array of ToolTraceState
 */
export const addToolTraceResultEntry = (state: ToolTraceState[], toolCallId: string, result: ToolResult): ToolTraceState[] => {
    return state.map((traceState: ToolTraceState) => {
        const executedTools: UIToolMessage[] = traceState.executedTools;

        const matchingToolCall: UIToolMessage | undefined = executedTools.find((toolMsg: UIToolMessage) => toolMsg.id === toolCallId);

        if (!matchingToolCall) {
            return traceState;
        }

        const updatedToolCall = {
            ...matchingToolCall,
            result,
        };

        return {
            ...traceState,
            executedTools: executedTools.map((toolMsg: UIToolMessage) => (toolMsg.id === toolCallId ? updatedToolCall : toolMsg)),
        };
    });
};

/***
 * Function to update the last tool trace entry in the tool trace state array.
 *
 * @param state - Current array of ToolTraceState
 * @param isError - Whether the update is due to an error
 * @param isAborted - Whether the update is due to an abortion
 *
 * @returns Updated array of ToolTraceState
 */
export const updateLastToolTraceEntry = (state: ToolTraceState[], isError?: boolean, isAborted?: boolean) => {
    const lastToolTraceState: ToolTraceState | undefined = state.length > 0 ? state[state.length - 1] : undefined;

    if (!lastToolTraceState) {
        return state;
    }

    return state.map((traceState: ToolTraceState) => {
        const usedToolsCount: number = lastToolTraceState.executedTools.length;
        const usedTools: boolean = usedToolsCount > 0;
        const isUpdatingCurrentTraceState: boolean = traceState.stateForMessageId === lastToolTraceState.stateForMessageId;

        if (!isUpdatingCurrentTraceState) {
            return traceState;
        }

        if (isError) {
            return {
                ...traceState,
                uiMessage: "Tool tracing was interrupted due to error",
            };
        }

        if (isAborted) {
            return {
                ...traceState,
                uiMessage: usedTools ? `User aborted after using ${usedToolsCount} ${usedToolsCount === 1 ? "tool" : "tools"}` : "User aborted before using any tools",
            };
        }

        return {
            ...traceState,
            uiMessage: usedTools ? `Used ${usedToolsCount} ${usedToolsCount === 1 ? "tool" : "tools"}` : "",
        };
    });
};

export const handleToolTraceStateOnThreadFetch = (fetchedMessages: UIMessage[]): ToolTraceState[] => {
    const toolTraceStates: ToolTraceState[] = [];

    let traceState: ToolTraceState | null = null;
    let validTraceId: string | null = null;
    let lastUserMessageId: string | null = null;

    for (const msg of fetchedMessages) {
        const isUserOrAssistant = msg.role === UI_MESSAGE_ROLES.USER || msg.role === UI_MESSAGE_ROLES.ASSISTANT;

        if (isUserOrAssistant && traceState) {
            traceState.uiMessage = `Used ${traceState.executedTools.length} ${traceState.executedTools.length === 1 ? "tool" : "tools"}`;

            toolTraceStates.push(traceState);
            traceState = null;
        }

        if (isUserOrAssistant && !traceState) {
            validTraceId = msg.id;

            if (msg.role === UI_MESSAGE_ROLES.USER) {
                lastUserMessageId = msg.id;
            }

            continue;
        }

        if (msg.role === UI_MESSAGE_ROLES.TOOL) {
            const executedTools: UIToolMessage[] = traceState && Array.isArray(traceState.executedTools) ? [...traceState.executedTools, msg as UIToolMessage] : [msg as UIToolMessage];

            traceState = {
                stateForMessageId: validTraceId || msg.responseForUserQueryId || msg.id,
                executedTools,
                uiMessage: "",
                responseForUserQueryId: lastUserMessageId || msg.responseForUserQueryId || undefined,
            };
        }
    }

    // Push any remaining trace state (when messages end with tool messages, e.g., during streaming)
    if (traceState) {
        traceState.uiMessage = `Used ${traceState.executedTools.length} ${traceState.executedTools.length === 1 ? "tool" : "tools"}`;
        toolTraceStates.push(traceState);
    }

    return toolTraceStates;
};
