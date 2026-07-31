import type { IoAiWeb } from "@interopio/ai-web";

import type { IoAssistStoreInstance } from "../stores";
import { UI_MESSAGE_ROLES, MESSAGES_LOADING_STATE, TOOL_RESULT_TYPES, RESPONSE_STREAM_STATUS } from "../types";
import type { UIMessage, UIToolMessage } from "../types";
import { logger } from "../utils/logger";
import { safeStringify } from "../utils/safeStringify";
import { ensureAssistantMessage, withAllTraceLabelsFinalized, withExecutedToolUpdated, withToolAppendedToTrace } from "../utils/streamUtils";

const LOGGER_NAME = "ResponseStream";
const log = logger.get(LOGGER_NAME);

type ToolCallState = {
    args: string;
    toolName?: string;
};

/**
 * AG-UI event with the optional payload fields we read off it. The upstream
 * `IoAiWeb.Agents.StreamEvent` has a `[key: string]: unknown` index signature
 * — this narrows the per-case payload fields without resorting to `any`. The
 * `type` discriminant is widened to include extension events some backends
 * emit (`TEXT_MESSAGE_CHUNK`, `MESSAGES_SNAPSHOT`) that aren't yet listed in
 * `IoAiWeb.Agents.StreamEventType`.
 */
type AgUiEventType = IoAiWeb.Agents.StreamEventType | "TEXT_MESSAGE_CHUNK" | "MESSAGES_SNAPSHOT";

type AgUiEvent = Omit<IoAiWeb.Agents.StreamEvent, "type"> & {
    type: AgUiEventType;
    messageId?: string;
    delta?: string;
    content?: string | { text?: string } | unknown;
    toolCallId?: string;
    toolCallName?: string;
    messages?: unknown[];
};

export async function processResponseStream(runHandle: IoAiWeb.Agents.StreamResponse, threadId: string, store: IoAssistStoreInstance, isActiveThread: () => boolean): Promise<void> {
    if (!runHandle || typeof runHandle.subscribe !== "function") {
        throw new Error("Invalid response stream object");
    }

    const toolCallArgsMap = new Map<string, ToolCallState>();
    let streamedContent = "";
    let currentMessageId = "";
    // Tracks whether currentMessageId was created as a synthetic placeholder
    // for a tool call that fired before any TEXT_MESSAGE_START.
    let hasSyntheticPlaceholder = false;

    return new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line prefer-const
        let subscription: { unsubscribe?: () => void } | undefined;
        const safeUnsubscribe = () => subscription?.unsubscribe?.();
        subscription = runHandle.subscribe({
            next: (rawEvent: IoAiWeb.Agents.StreamEvent) => {
                const event: AgUiEvent = rawEvent;
                const state = store.getState();
                const isBackground = !isActiveThread();

                // Debug: log every AG-UI event so multi-turn / sampling-continuation
                // flows are diagnosable from the browser console.
                log.debug(`AG-UI event ${event?.type ?? "unknown"}: ${safeStringify(event)}`);

                switch (event.type) {
                    case "TEXT_MESSAGE_START": {
                        const incomingId: string | undefined = event.messageId;

                        // Reuse the synthetic placeholder only when this TEXT_MESSAGE_START
                        // belongs to the SAME turn that created it. A new turn (after a
                        // sampling/tool-result continuation) arrives with a different
                        // messageId — in that case we must create a fresh assistant
                        // message so its text isn't appended to the prior turn's bubble.
                        const sameTurnAsPlaceholder = hasSyntheticPlaceholder && (!incomingId || incomingId === currentMessageId);

                        if (sameTurnAsPlaceholder) {
                            streamedContent = "";
                            hasSyntheticPlaceholder = false;
                        } else {
                            currentMessageId = incomingId || crypto.randomUUID();
                            streamedContent = "";
                            hasSyntheticPlaceholder = false;

                            if (!isBackground) {
                                state.addMessage({
                                    id: currentMessageId,
                                    role: UI_MESSAGE_ROLES.ASSISTANT,
                                    content: "",
                                });
                            }
                        }
                        break;
                    }

                    case "TEXT_MESSAGE_CONTENT": {
                        streamedContent += event.delta || "";

                        if (isBackground) {
                            state.setStreamState(threadId, {
                                content: streamedContent,
                                messageId: currentMessageId,
                            });
                            return;
                        }

                        // Defensive: some backends emit TEXT_MESSAGE_CONTENT without a
                        // preceding TEXT_MESSAGE_START (e.g. on turn-2 continuation
                        // after a sampling result). Create an assistant message on the
                        // fly so the streamed text actually renders.
                        const ensuredId = ensureAssistantMessage(state, currentMessageId, event.messageId);
                        if (ensuredId !== currentMessageId) {
                            currentMessageId = ensuredId;
                        }

                        state.updateMessage(currentMessageId, { content: streamedContent });
                        break;
                    }

                    case "TEXT_MESSAGE_END":
                        // Treat end-of-text as a turn boundary so any TOOL_CALL_START
                        // that follows in the SAME turn doesn't reuse this message id
                        // for a synthetic placeholder check on a later turn.
                        hasSyntheticPlaceholder = false;
                        break;

                    case "TEXT_MESSAGE_CHUNK": {
                        // Combined start+content+end shorthand some backends emit.
                        const chunkId: string | undefined = event.messageId;
                        if (chunkId && chunkId !== currentMessageId) {
                            currentMessageId = chunkId;
                            streamedContent = "";
                            hasSyntheticPlaceholder = false;
                            if (!isBackground) {
                                state.addMessage({
                                    id: currentMessageId,
                                    role: UI_MESSAGE_ROLES.ASSISTANT,
                                    content: "",
                                });
                            }
                        }
                        const chunkText = event.delta ?? (typeof event.content === "string" ? event.content : "");
                        streamedContent += chunkText || "";
                        if (isBackground) {
                            state.setStreamState(threadId, {
                                content: streamedContent,
                                messageId: currentMessageId,
                            });
                        } else {
                            const ensuredId = ensureAssistantMessage(state, currentMessageId, chunkId);
                            if (ensuredId !== currentMessageId) currentMessageId = ensuredId;
                            state.updateMessage(currentMessageId, { content: streamedContent });
                        }
                        break;
                    }

                    case "MESSAGES_SNAPSHOT": {
                        // Reconciliation event some backends emit at the end of a turn.
                        // If the snapshot contains an assistant message with content that
                        // hasn't been streamed (e.g. turn-2 after sampling), surface it.
                        if (isBackground) break;
                        const snapshotMessages: unknown[] = Array.isArray(event.messages) ? (event.messages as unknown[]) : [];
                        for (const raw of snapshotMessages) {
                            const m = raw as {
                                id?: string;
                                role?: string;
                                content?: string | { text?: string };
                            };
                            if (m?.role !== "assistant") continue;
                            const text = typeof m.content === "string" ? m.content : (m.content?.text ?? "");
                            if (!text) continue;
                            const messageId = m.id ?? crypto.randomUUID();
                            const existing = state.messages.find((x: UIMessage) => x.id === messageId);
                            if (existing) {
                                if (!existing.content || existing.content.length < text.length) {
                                    state.updateMessage(messageId, { content: text });
                                }
                            } else {
                                state.addMessage({
                                    id: messageId,
                                    role: UI_MESSAGE_ROLES.ASSISTANT,
                                    content: text,
                                });
                            }
                        }
                        break;
                    }

                    case "TOOL_CALL_START": {
                        streamedContent = "";

                        // If no assistant message has started yet, create a synthetic
                        // placeholder so the trace has a real message ID to anchor to.
                        if (!currentMessageId) {
                            currentMessageId = crypto.randomUUID();
                            hasSyntheticPlaceholder = true;
                            if (!isBackground) {
                                state.addMessage({
                                    id: currentMessageId,
                                    role: UI_MESSAGE_ROLES.ASSISTANT,
                                    content: "",
                                });
                            }
                        }

                        const toolMessage: UIToolMessage = {
                            id: event.toolCallId || crypto.randomUUID(),
                            toolName: event.toolCallName || "unknown",
                            args: {},
                            role: UI_MESSAGE_ROLES.TOOL,
                        };

                        toolCallArgsMap.set(toolMessage.id, {
                            args: "",
                            toolName: toolMessage.toolName,
                        });

                        if (isBackground) {
                            const currentStream = state.streamsByThreadId[threadId];
                            state.setStreamState(threadId, {
                                toolMessages: [...(currentStream?.toolMessages ?? []), toolMessage],
                            });
                            return;
                        }

                        state.addMessage(toolMessage);

                        state.setToolTraceState(withToolAppendedToTrace(state.toolTraceState, currentMessageId, toolMessage));
                        break;
                    }

                    case "TOOL_CALL_ARGS": {
                        const toolCallId = event.toolCallId || "";
                        if (!toolCallId) return;

                        const current = toolCallArgsMap.get(toolCallId) || { args: "" };
                        toolCallArgsMap.set(toolCallId, {
                            ...current,
                            args: current.args + (event.delta || ""),
                        });
                        break;
                    }

                    case "TOOL_CALL_END": {
                        const toolCallId = event.toolCallId || "";
                        if (!toolCallId) return;

                        const toolCallState = toolCallArgsMap.get(toolCallId);
                        let parsedArgs: Record<string, unknown> = {};

                        try {
                            parsedArgs = JSON.parse(toolCallState?.args || "{}");
                        } catch {
                            parsedArgs = {};
                        }

                        if (isBackground) {
                            const currentStream = state.streamsByThreadId[threadId];
                            state.setStreamState(threadId, {
                                toolMessages: (currentStream?.toolMessages ?? []).map((tm) => (tm.id === toolCallId ? { ...tm, args: parsedArgs } : tm)),
                            });
                        } else {
                            state.updateMessage(toolCallId, { args: parsedArgs });

                            // Update the tool's args but keep the in-flight "Called tool: X"
                            // label — it's finalized to "Used N tools" only on completion.
                            state.setToolTraceState(
                                withExecutedToolUpdated(state.toolTraceState, toolCallId, {
                                    args: parsedArgs,
                                })
                            );
                        }
                        break;
                    }

                    case "TOOL_CALL_RESULT": {
                        const resultToolCallId = event.toolCallId || "";
                        if (!resultToolCallId) return;

                        // AG-UI carries the tool result on `event.content` (string or object),
                        // NOT `event.result`. When it's a string, try to JSON.parse it; on
                        // parse failure, wrap as a TEXT ToolResult to match ng's behaviour.
                        let result: unknown = event.content;
                        if (typeof result === "string") {
                            try {
                                result = JSON.parse(result);
                            } catch {
                                result = { type: TOOL_RESULT_TYPES.TEXT, text: result };
                            }
                        }

                        if (isBackground) {
                            const currentStream = state.streamsByThreadId[threadId];
                            state.setStreamState(threadId, {
                                toolMessages: (currentStream?.toolMessages ?? []).map((tm) => (tm.id === resultToolCallId ? { ...tm, result: result as UIToolMessage["result"] } : tm)),
                            });
                        } else {
                            state.updateMessage(resultToolCallId, {
                                result,
                            } as Partial<UIToolMessage>);

                            state.setToolTraceState(
                                withExecutedToolUpdated(state.toolTraceState, resultToolCallId, {
                                    result,
                                } as Partial<UIToolMessage>)
                            );
                        }
                        break;
                    }
                }
            },
            error: (error: Error) => {
                const storeState = store.getState();
                storeState.setIsGeneratingResponse(false);
                safeUnsubscribe();

                const wasAborted = storeState.streamsByThreadId[threadId]?.status === RESPONSE_STREAM_STATUS.ABORTED;
                if (wasAborted) {
                    resolve();
                    return;
                }

                storeState.failStream(threadId, error.message || "Error during response generation");
                storeState.setIsLastResponseSuccess(false);
                storeState.setMessageLoadingState({
                    type: MESSAGES_LOADING_STATE.ERROR,
                    message: error.message || "Error during response generation",
                });
                reject(error);
            },
            complete: () => {
                const finalState = store.getState();

                // Finalize all trace labels for this assistant turn — but don't clobber
                // the "User aborted after using N tools" label set by abortActiveStream
                // if the user stopped this stream.
                const wasAborted = finalState.streamsByThreadId[threadId]?.status === RESPONSE_STREAM_STATUS.ABORTED;
                if (isActiveThread() && !wasAborted) {
                    finalState.setToolTraceState(withAllTraceLabelsFinalized(finalState.toolTraceState));
                }

                const shouldNotify = !isActiveThread();
                finalState.completeStream(threadId, shouldNotify);

                finalState.setIsGeneratingResponse(false);
                if (wasAborted) {
                    // User stop — not a success. Match ng's NOT_STARTED reset (no error, footer shows).
                    finalState.setMessageLoadingState({
                        type: MESSAGES_LOADING_STATE.NOT_STARTED,
                    });
                } else {
                    finalState.setIsLastResponseSuccess(true);
                    finalState.setMessageLoadingState({
                        type: MESSAGES_LOADING_STATE.GET_RESPONSE_SUCCESS,
                    });
                }
                safeUnsubscribe();
                resolve();
            },
        });
    });
}
