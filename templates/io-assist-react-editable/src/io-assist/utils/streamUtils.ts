import { UI_MESSAGE_ROLES } from "../types";
import type { UIMessage, UIToolMessage, ToolTraceState } from "../types";

/**
 * Slice of the message store that `ensureAssistantMessage` reads/writes.
 * Typed as a structural subset so the helper isn't coupled to the full store.
 */
type EnsureAssistantStateSlice = {
    messages: UIMessage[];
    addMessage: (message: UIMessage) => void;
};

/**
 * Processes AG-UI stream events from agent.stream() and updates the Zustand store.
 * Handles both active thread streaming (writes to messageStore) and background
 * thread streaming (buffers into responseStreamStore for later merge).
 */
function traceLabelFor(count: number): string {
    return count > 0 ? `Used ${count} tool${count !== 1 ? "s" : ""}` : "";
}

function abortedLabelFor(count: number): string {
    return count > 0 ? `User aborted after using ${count} tool${count !== 1 ? "s" : ""}` : "User aborted before using any tools";
}

export function withAllTraceLabelsAborted(traces: ToolTraceState[]): ToolTraceState[] {
    if (traces.length === 0) return traces;
    const lastIdx = traces.length - 1;
    return traces.map((t, i) => (i === lastIdx ? { ...t, uiMessage: abortedLabelFor(t.executedTools.length) } : t));
}

export function withTraceLabel(traces: ToolTraceState[], messageId: string): ToolTraceState[] {
    return traces.map((t) => (t.stateForMessageId === messageId ? { ...t, uiMessage: traceLabelFor(t.executedTools.length) } : t));
}

export function withAllTraceLabelsFinalized(traces: ToolTraceState[]): ToolTraceState[] {
    return traces.map((t) => ({
        ...t,
        uiMessage: traceLabelFor(t.executedTools.length),
    }));
}

export function withExecutedToolUpdated(traces: ToolTraceState[], toolCallId: string, changes: Partial<UIToolMessage>): ToolTraceState[] {
    return traces.map((t) => ({
        ...t,
        executedTools: t.executedTools.map((tool) => (tool.id === toolCallId ? { ...tool, ...changes } : tool)),
    }));
}

export function withToolAppendedToTrace(traces: ToolTraceState[], parentMessageId: string, toolMessage: UIToolMessage): ToolTraceState[] {
    const existing = traces.find((t) => t.stateForMessageId === parentMessageId || t.executedTools.some((et) => et.id === toolMessage.id));

    const callingLabel = `Called tool: ${toolMessage.toolName}`;

    if (!existing) {
        return [
            ...traces,
            {
                stateForMessageId: parentMessageId,
                executedTools: [toolMessage],
                uiMessage: callingLabel,
                isExpanded: false,
            },
        ];
    }

    return traces.map((t) => (t.stateForMessageId === existing.stateForMessageId ? { ...t, executedTools: [...t.executedTools, toolMessage], uiMessage: callingLabel } : t));
}

// Returns the message id we should write to. If no assistant message exists
// yet for `currentMessageId`, creates one (using `incomingId` if provided)
// and returns the new id.
export function ensureAssistantMessage(state: EnsureAssistantStateSlice, currentMessageId: string, incomingId?: string): string {
    const exists = currentMessageId && state.messages.some((m: UIMessage) => m.id === currentMessageId);
    if (exists) return currentMessageId;

    const id = currentMessageId || incomingId || crypto.randomUUID();
    state.addMessage({
        id,
        role: UI_MESSAGE_ROLES.ASSISTANT,
        content: "",
    });
    return id;
}
