import type { IoAiWeb } from "@interopio/ai-web";

import { UI_MESSAGE_ROLES } from "../types";
import type { UIAssistantMessage, UIMessage, UIUserMessage, ToolTraceState } from "../types";

export type RenderItem =
    | { type: "user"; message: UIUserMessage }
    | { type: "assistant"; message: UIAssistantMessage }
    | { type: "tool-trace"; trace: ToolTraceState }
    | { type: "mcp-app"; app: IoAiWeb.McpApps.AppInstance };

/**
 * Aggregates a response into copyable text, mirroring ng's `responseToText`.
 *
 * A response is every non-user message between the user query and the next user
 * query: assistant text is taken verbatim, tool calls are rendered as
 * `Tool (name) input: … result: …` so the tool name/IO is copyable too.
 */
export function responseToText(messages: UIMessage[], userQueryId: string): string {
    const startIdx = messages.findIndex((m) => m.id === userQueryId);
    if (startIdx < 0) return "";

    const parts: string[] = [];
    for (let i = startIdx + 1; i < messages.length; i++) {
        const message = messages[i];
        if (message.role === UI_MESSAGE_ROLES.USER) break;
        if (message.role === UI_MESSAGE_ROLES.ASSISTANT) {
            parts.push(message.content ?? "");
        } else if (message.role === UI_MESSAGE_ROLES.TOOL) {
            parts.push(`Tool (${message.toolName}) input: ${JSON.stringify(message.args ?? "")} result: ${JSON.stringify(message.result ?? "")}`);
        }
    }
    return parts.join("\n");
}

export type FooterHosts = {
    /** assistant message id → user query id (footer rendered on the assistant). */
    assistant: Map<string, string>;
    /** tool-trace `stateForMessageId` → user query id (footer on the trace). */
    trace: Map<string, string>;
};

/**
 * Determines where each response's single footer belongs, mirroring ng.
 *
 * A response is a group of render items answering one user query; React may split
 * it into several assistant text messages, tool-traces, and mcp-apps. The footer
 * attaches to the *last* footer-capable item of the group — the trailing
 * tool-trace when the response ends in a tool call (e.g. an aborted tool run),
 * otherwise the last text-bearing assistant message. Operates on the render list
 * so interleaved traces/apps are ordered exactly as displayed.
 */
export function computeFooterHosts(items: RenderItem[]): FooterHosts {
    const assistant = new Map<string, string>();
    const trace = new Map<string, string>();

    let currentUserId: string | null = null;
    let lastCandidate: { kind: "assistant" | "trace"; id: string } | null = null;

    const flush = (): void => {
        if (currentUserId && lastCandidate) {
            const target = lastCandidate.kind === "assistant" ? assistant : trace;
            target.set(lastCandidate.id, currentUserId);
        }
        lastCandidate = null;
    };

    for (const item of items) {
        if (item.type === "user") {
            flush();
            currentUserId = item.message.id;
        } else if (item.type === "assistant") {
            if (item.message.content?.trim()) {
                lastCandidate = { kind: "assistant", id: item.message.id };
            }
        } else if (item.type === "tool-trace") {
            lastCandidate = { kind: "trace", id: item.trace.stateForMessageId };
        }
        // mcp-app items are never footer hosts; they don't reset lastCandidate.
    }
    flush();

    return { assistant, trace };
}

export function buildRenderList(messages: UIMessage[], toolTraces: ToolTraceState[], mcpAppInstances: IoAiWeb.McpApps.AppInstance[] = []): RenderItem[] {
    const result: RenderItem[] = [];
    const toolMessageIds = new Set(toolTraces.flatMap((t) => t.executedTools.map((et) => et.id)));

    const messageRoleById = new Map<string, string>();
    const messageIndexById = new Map<string, number>();
    messages.forEach((m, i) => {
        messageRoleById.set(m.id, m.role);
        messageIndexById.set(m.id, i);
    });

    // Resolve each trace to an assistant message id. If a trace is anchored on a
    // user (or otherwise non-assistant) message — which happens when history is
    // loaded as user → tool → assistant and the parent is captured before the
    // assistant arrives — re-anchor it to the next assistant in the sequence and
    // render it above that assistant.
    const traceByAssistantIdAfter = new Map<string, ToolTraceState>();
    const traceByAssistantIdBefore = new Map<string, ToolTraceState>();
    const assistantIdByTrace = new Map<ToolTraceState, string>();
    for (const trace of toolTraces) {
        const targetRole = messageRoleById.get(trace.stateForMessageId);
        if (targetRole === UI_MESSAGE_ROLES.ASSISTANT) {
            traceByAssistantIdAfter.set(trace.stateForMessageId, trace);
            assistantIdByTrace.set(trace, trace.stateForMessageId);
            continue;
        }
        const startIdx = messageIndexById.get(trace.stateForMessageId) ?? -1;
        for (let i = startIdx + 1; i < messages.length; i++) {
            if (messages[i].role === UI_MESSAGE_ROLES.ASSISTANT) {
                traceByAssistantIdBefore.set(messages[i].id, trace);
                assistantIdByTrace.set(trace, messages[i].id);
                break;
            }
        }
    }

    // Index: tool-call id → owning trace. AppInstance.id is the toolCallId
    // (libs/ai-web/src/domains/mcp-apps/instance.ts:80), so apps are matched to
    // a trace via that id and then rendered under that trace's assistant message.
    const traceByToolCallId = new Map<string, ToolTraceState>();
    for (const trace of toolTraces) {
        for (const et of trace.executedTools) {
            traceByToolCallId.set(et.id, trace);
        }
    }

    const mcpAppsByAssistantId = new Map<string, IoAiWeb.McpApps.AppInstance[]>();
    for (const app of mcpAppInstances) {
        const trace = traceByToolCallId.get(app.id);
        if (!trace) continue;
        const assistantId = assistantIdByTrace.get(trace);
        if (!assistantId) continue;
        const bucket = mcpAppsByAssistantId.get(assistantId) ?? [];
        bucket.push(app);
        mcpAppsByAssistantId.set(assistantId, bucket);
    }

    for (const message of messages) {
        // Skip raw tool messages — they're rendered inside traces
        if (message.role === UI_MESSAGE_ROLES.TOOL && toolMessageIds.has(message.id)) {
            continue;
        }

        if (message.role === UI_MESSAGE_ROLES.USER) {
            result.push({ type: "user", message });
            continue;
        }

        if (message.role === UI_MESSAGE_ROLES.ASSISTANT) {
            const traceBefore = traceByAssistantIdBefore.get(message.id);
            if (traceBefore) {
                result.push({ type: "tool-trace", trace: traceBefore });
            }

            result.push({ type: "assistant", message });

            const traceAfter = traceByAssistantIdAfter.get(message.id);
            if (traceAfter) {
                result.push({ type: "tool-trace", trace: traceAfter });
            }

            const apps = mcpAppsByAssistantId.get(message.id);
            if (apps) {
                for (const app of apps) result.push({ type: "mcp-app", app });
            }
            continue;
        }
    }

    return result;
}
