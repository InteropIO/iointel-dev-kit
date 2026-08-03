import { UI_STRINGS } from "../constants/uiStrings";
import type { UIMessage, UIThread, ToolTraceState } from "../types";
import { UI_MESSAGE_ROLES } from "../types";
import { logger } from "./logger";
import { safeStringify } from "./safeStringify";

const LOGGER_NAME = "ThreadUtils";
const log = logger.get(LOGGER_NAME);

export type ThreadGroup = {
    label: string;
    threads: UIThread[];
};

const DIV = UI_STRINGS.THREAD_HISTORY_COMPONENT.DIVIDERS;

const MS = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
};

function getBucketLabel(diff: number): string {
    if (diff < MS.minute) return DIV.JUST_NOW;
    if (diff < 5 * MS.minute) return DIV.FIVE_MINS_AGO;
    if (diff < 30 * MS.minute) return DIV.THIRTY_MINS_AGO;
    if (diff < MS.hour) return DIV.ONE_HOUR_AGO;
    if (diff < 2 * MS.hour) return DIV.TWO_HOURS_AGO;
    if (diff < 6 * MS.hour) return DIV.SIX_HOURS_AGO;
    if (diff < 12 * MS.hour) return DIV.TWELVE_HOURS_AGO;
    if (diff < MS.day) return DIV.TODAY;
    if (diff < 2 * MS.day) return DIV.YESTERDAY;
    if (diff < 3 * MS.day) return DIV.TWO_DAYS_AGO;
    if (diff < MS.week) return DIV.LAST_WEEK;
    if (diff < 2 * MS.week) return DIV.TWO_WEEKS_AGO;
    if (diff < MS.month) return DIV.ONE_MONTH_AGO;
    if (diff < 3 * MS.month) return DIV.THREE_MONTHS_AGO;
    if (diff < 6 * MS.month) return DIV.SIX_MONTHS_AGO;
    return DIV.MORE_THAN_YEAR_AGO;
}

/**
 * Groups threads into time buckets for display in the thread history sidebar.
 * Threads are sorted newest-first within each group.
 */
export function groupThreadsByTime(threads: UIThread[]): ThreadGroup[] {
    const now = Date.now();
    const groups = new Map<string, UIThread[]>();
    const labelOrder: string[] = [];

    const sorted = [...threads].sort((a, b) => (b.updatedAt ?? b.createdAt).getTime() - (a.updatedAt ?? a.createdAt).getTime());

    for (const thread of sorted) {
        const date = thread.updatedAt ?? thread.createdAt;
        const diff = now - date.getTime();
        const label = getBucketLabel(diff);

        if (!groups.has(label)) {
            groups.set(label, []);
            labelOrder.push(label);
        }

        groups.get(label)!.push(thread);
    }

    return labelOrder.map((label) => ({
        label,
        threads: groups.get(label)!,
    }));
}

/**
 * Builds ToolTraceState[] from a flat UIMessage[] (e.g. loaded from thread history).
 * Groups tool messages under the preceding user/assistant message ID.
 */
export function buildToolTraceFromMessages(messages: UIMessage[]): ToolTraceState[] {
    const traces: ToolTraceState[] = [];
    let currentParentId: string | null = null;
    let currentTrace: ToolTraceState | null = null;

    for (const msg of messages) {
        if (msg.role === UI_MESSAGE_ROLES.USER || msg.role === UI_MESSAGE_ROLES.ASSISTANT) {
            if (currentTrace) {
                traces.push(currentTrace);
                currentTrace = null;
            }
            currentParentId = msg.id;
        }
        if (msg.role === UI_MESSAGE_ROLES.TOOL && currentParentId) {
            if (!currentTrace) {
                currentTrace = {
                    stateForMessageId: currentParentId,
                    executedTools: [],
                    uiMessage: "",
                    isExpanded: false,
                };
            }
            currentTrace.executedTools.push(msg);
        }
    }
    if (currentTrace) traces.push(currentTrace);

    for (const trace of traces) {
        const n = trace.executedTools.length;
        trace.uiMessage = n > 0 ? `Used ${n} tool${n !== 1 ? "s" : ""}` : "";
    }

    log.debug(`Built tool traces: ${safeStringify(traces)}`);
    return traces;
}

export function generateThreadTitle(firstUserMessage: string): string {
    const trimmed = firstUserMessage.trim();
    if (trimmed.length <= 50) return trimmed;
    return trimmed.substring(0, 47) + "...";
}
