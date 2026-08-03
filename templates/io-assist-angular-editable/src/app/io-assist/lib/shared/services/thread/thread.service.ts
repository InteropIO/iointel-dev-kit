/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";

import { UIResponseMessage, UIMessageType, UI_MESSAGE_ROLES, UI_MESSAGE_PART_TYPES, UIUserMessage } from "../../store/message/types";
import { UIThread } from "../../store/thread/types";
import { IOAiWebService } from "../io-ai-web/io-ai-web.service";
import { LoggerService } from "../logger/logger.service";

@Injectable({
    providedIn: "root",
})
export class ThreadService {
    private readonly _ioIntelWebService: IOAiWebService = inject(IOAiWebService);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "ThreadService";

    public fetchThreads(agentId: string, resourceId: string): Promise<IoAiWeb.Threads.Thread[]> {
        return this._ioIntelWebService.listThreads({ agentId, resourceId });
    }

    public renameThread(thread: UIThread, newTitle: string): Promise<void> {
        if (!newTitle || newTitle.trim() === "") {
            throw new Error("Invalid thread title");
        }

        if (thread.title === newTitle) {
            throw new Error("Thread title is the same");
        }

        return thread.update({ title: newTitle });
    }

    public deleteThread(thread: UIThread): Promise<void> {
        return thread.delete();
    }

    public deleteThreadState(threadId: string): Promise<void> {
        return this._ioIntelWebService.deleteThreadState({ threadId });
    }

    public async toUIThreads(threads: IoAiWeb.Threads.Thread[]): Promise<UIThread[]> {
        if (threads.length === 0) return Promise.resolve([]);

        const convertedUIThreads: UIThread[] = [];

        threads.map((thread: IoAiWeb.Threads.Thread) => {
            const tempThread: UIThread = this.convertSingleUIThread(thread);

            convertedUIThreads.push(tempThread);
        });

        return Promise.resolve(convertedUIThreads);
    }

    public async fetchMessagesFromThread(thread: UIThread): Promise<UIResponseMessage[]> {
        // TODO: Maybe limit should be optional in future - for now we fetch last 100 messages
        try {
            const messages: any = await thread.getMessages({ limit: 100 });

            if (!messages.messages) {
                throw new Error("No messages found in thread");
            }

            return this.convertToUIResponseMessages(messages.messages);
        } catch (error: any) {
            this._logger.get(this.LOGGER_NAME).error(`Failed to fetch thread messages: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }

    /**
     * The uiMessages can look like this:
     * They are of 'role' either 'user' or 'assistant'
     * [
     *    {
            ...,
            ...,
            "role": "user",
            "parts": [
                {
                    "type": "text",
                    "text": "Hello!"
                }
            ],
            ...
        },
        {
            ...,
            ...,
            "role": "assistant",
            "parts": [
                {
                    "type": "text",
                    "text": "..."
                }
                {
                    "type": "tool-invocation",
                    "tool-invocation": {
                        "toolCallId": ...
                        "toolName": ...
                        "args": ...
                        "result": ...
                    }
                }
            ]
        }
     * ]
     * @param uiMessages - Array of messages from IoAiWeb API
     * @returns Array of UIResponseMessage mapped from the input messages
     */
    public convertToUIResponseMessages(uiMessages: any[]): UIResponseMessage[] {
        const result: (UIResponseMessage | null)[] = [];
        const toolCallMap = new Map<string, UIResponseMessage>();

        uiMessages.forEach((message) => {
            const role: UIMessageType = message.role;
            const parts: any[] = message.content.parts;

            if (role === UI_MESSAGE_ROLES.USER) {
                return result.push(this.toUserUIMessage(message, parts));
            }

            if (role === UI_MESSAGE_ROLES.ASSISTANT) {
                return parts.forEach((part: any) => {
                    const msg = this.toAssistantUIMessage(part, toolCallMap);

                    if (msg === null) {
                        return;
                    }

                    result.push(msg);
                });
            }

            // Other types can be handled here if needed
            return;
        });

        return result.filter((msg: UIResponseMessage | null) => msg !== null);
    }

    private toUserUIMessage(message: any, parts: any[]): UIUserMessage | null {
        const userMessage: UIUserMessage = {
            id: message.id,
            role: UI_MESSAGE_ROLES.USER,
            content: parts.find((part: any) => part.type === UI_MESSAGE_PART_TYPES.TEXT)?.text || "",
        };

        return userMessage;
    }

    private toAssistantUIMessage(part: any, toolCallMap: Map<string, UIResponseMessage>): UIResponseMessage | null {
        if (part.type === UI_MESSAGE_PART_TYPES.TEXT) {
            return {
                id: crypto.randomUUID(), // Generate unique ID for each assistant text part to avoid ID collision with parent message
                role: UI_MESSAGE_ROLES.ASSISTANT,
                content: part.text,
            };
        }

        if (part.type === UI_MESSAGE_PART_TYPES.TOOL_INVOCATION) {
            const toolInvocation = part.toolInvocation;
            const toolCallId = toolInvocation.toolCallId;
            const state = toolInvocation.state;

            // If this is a result, update the existing call instead of creating new message
            if (state === "result") {
                const existingCall = toolCallMap.get(toolCallId);

                if (existingCall) {
                    (existingCall as any).result = toolInvocation.result;
                    // Skip adding new message
                    return null;
                }

                // No preceding call found (new format: Tool part comes directly with a tool result)
            }

            const newMessage: UIResponseMessage = {
                id: toolCallId,
                role: UI_MESSAGE_ROLES.TOOL,
                toolName: toolInvocation.toolName,
                args: toolInvocation.args,
                result: toolInvocation.result,
                isExpanded: false,
            };

            if (state === "call") {
                toolCallMap.set(toolCallId, newMessage);
            }

            return newMessage;
        }

        return null;
    }

    private convertSingleUIThread(thread: IoAiWeb.Threads.Thread): UIThread {
        const UIThread: UIThread = {
            ...thread,
            title: thread.title ? thread.title : thread.createdAt.toISOString(),
        };

        return UIThread;
    }
}
