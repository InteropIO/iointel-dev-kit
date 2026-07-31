import { type UIMessage, type UIToolMessage, UI_MESSAGE_ROLES, type UIUserMessage, type UIAssistantMessage } from "../types";
import { logger } from "./logger";
import { safeStringify } from "./safeStringify";

const LOGGER_NAME = "MessageConverter";
const log = logger.get(LOGGER_NAME);

// The raw thread-message payload from `IoAiWeb.Threads.GetMessagesResponse.messages`
// is `any[]` in the upstream d.ts — we narrow via these shape descriptors
// rather than `any`.
type RawTextPart = { type: "text"; text?: string };
type RawToolInvocationPart = {
    type: "tool-invocation";
    id?: string;
    toolInvocation?: {
        toolCallId?: string;
        toolName?: string;
        args?: Record<string, unknown>;
        result?: UIToolMessage["result"];
    };
};
type RawMessagePart = RawTextPart | RawToolInvocationPart;

type RawMessageContent = string | { text?: string; parts?: RawMessagePart[] } | { text?: string }[] | null | undefined;

type RawThreadMessage = {
    id: string;
    role: "user" | "assistant" | string;
    content?: RawMessageContent;
};

export function convertThreadMessages(rawMessages: unknown[]): UIMessage[] {
    const result: UIMessage[] = [];
    const toolCallMap = new Map<string, UIToolMessage>();

    for (const raw of rawMessages) {
        const msg = raw as RawThreadMessage;
        if (msg.role === "user") {
            const content = extractTextContent(msg.content);
            result.push({ id: msg.id, role: UI_MESSAGE_ROLES.USER, content } as UIUserMessage);
        }

        if (msg.role === "assistant") {
            const contentObj = msg.content && typeof msg.content === "object" && !Array.isArray(msg.content) ? msg.content : null;
            const parts: RawMessagePart[] = contentObj?.parts ?? [];

            if (parts.length === 0) {
                const content = extractTextContent(msg.content);
                if (content.trim()) {
                    result.push({
                        id: msg.id,
                        role: UI_MESSAGE_ROLES.ASSISTANT,
                        content,
                    } as UIAssistantMessage);
                }
                continue;
            }

            for (let partIndex = 0; partIndex < parts.length; partIndex++) {
                const part = parts[partIndex];
                if (part.type === "text" && part.text?.trim()) {
                    result.push({
                        id: `${msg.id}_text_${partIndex}`,
                        role: UI_MESSAGE_ROLES.ASSISTANT,
                        content: part.text,
                    } as UIAssistantMessage);
                }

                if (part.type === "tool-invocation") {
                    const inv = part.toolInvocation;
                    const toolCallId = inv?.toolCallId ?? part.id;
                    if (!toolCallId) continue;

                    if (toolCallMap.has(toolCallId)) {
                        const existing = toolCallMap.get(toolCallId)!;
                        if (inv?.result !== undefined) existing.result = inv.result;
                    } else {
                        const toolMsg: UIToolMessage = {
                            id: toolCallId,
                            role: UI_MESSAGE_ROLES.TOOL,
                            toolName: inv?.toolName ?? "unknown",
                            args: inv?.args ?? {},
                            result: inv?.result,
                        };
                        toolCallMap.set(toolCallId, toolMsg);
                        result.push(toolMsg);
                    }
                }
            }
        }
    }

    log.debug(`Converted messages: ${safeStringify(result)}`);
    return result;
}

export function extractTextContent(content: unknown): string {
    if (content == null) return "";
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content.map((c) => (c as { text?: string })?.text ?? "").join("");
    }
    if (typeof content === "object") {
        const obj = content as { parts?: unknown; text?: unknown };
        if (Array.isArray(obj.parts)) {
            return (obj.parts as RawMessagePart[])
                .filter((p): p is RawTextPart => p.type === "text")
                .map((p) => p.text ?? "")
                .join("");
        }
        if (typeof obj.text === "string") return obj.text;
    }
    return JSON.stringify(content);
}
