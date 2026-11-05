import { TOOL_RESULT_TYPES, type ToolResult, type UIToolMessage } from "../types/message";

/**
 * Pure, framework-free normalizer: turns one executed tool call (as `ToolTraceMessage` stores
 * it after the AG-UI stream, or after loading a thread) into the shape the trace-step UI
 * renders. Ported from `libs/io-assist-ng`'s `tool-trace.normalizer.ts` — the code-mode branch
 * was dropped since React's `UIToolMessage` has no code-mode concept yet.
 *
 * Unlike ng, React's `result` is already a typed `ToolResult` by the time it reaches here (the
 * AG-UI stream handler in `processResponseStream.ts` does the JSON-parsing/wrapping), so there's
 * no raw-payload parsing to do here: a step with no result is "running" while the response is
 * still generating, or "error" once it's finished without ever getting one.
 */

export type StepStatus = "running" | "success" | "error" | "empty";
export type StepType = "tool" | "code";

export type TraceStep = {
    id: string;
    type: StepType;
    title: string;
    status: StepStatus;
    toolName: string;
    durationMs?: number;
    /** Only set for `type === "code"` steps (executeCode calls) - ported from ng's TraceStep. */
    explanation?: string;
    code?: string;
};

export type TracePhase = "working" | "failed" | "done";

export type TraceSummary = {
    phase: TracePhase;
    parts: string[];
    failedPartIndex?: number;
};

export type NormalizeContext = {
    isFinished: boolean;
};

const NO_RESULT_DETAILS = "No result received. The tool may have failed, timed out or been interrupted.";

const PROXY_ERROR_PATTERN = /^Error (?:executing proxy tool|invoking tool) "?([^":]+)"?:/;

// code mode's only tool call - ported from ng's `CODE_TOOL_NAME`.
export const CODE_TOOL_NAME = "executeCode";

const getStringArg = (args: Record<string, unknown> | undefined, key: string): string | undefined => {
    const value = args?.[key];

    return typeof value === "string" ? value : undefined;
};

export const normalizeStep = (tool: UIToolMessage, ctx: NormalizeContext): TraceStep => {
    const type: StepType = tool.toolName === CODE_TOOL_NAME ? "code" : "tool";
    const status = resultStatus(tool.result, ctx);
    const durationMs = tool.startedAt !== undefined && tool.completedAt !== undefined ? Math.max(0, tool.completedAt - tool.startedAt) : undefined;

    if (type === "code") {
        return {
            id: tool.id,
            type,
            toolName: tool.toolName,
            status,
            durationMs,
            explanation: getStringArg(tool.args, "explanation"),
            code: getStringArg(tool.args, "code"),
            title: getCodeTitle(status),
        };
    }

    return {
        id: tool.id,
        type,
        toolName: tool.toolName,
        status,
        durationMs,
        title: getToolTitle(tool.toolName, status),
    };
};

const resultStatus = (result: UIToolMessage["result"], ctx: NormalizeContext): StepStatus => {
    if (result === undefined || result === null) return ctx.isFinished ? "error" : "running";

    if (resultIsStoredError(result)) return "error";

    return resultIsEmpty(result) ? "empty" : "success";
};

const getBlockText = (block: unknown): string | undefined => {
    if (typeof block === "string") return block;

    if (!block || typeof block !== "object" || (block as ToolResult).type !== TOOL_RESULT_TYPES.TEXT) return undefined;

    const text: unknown = (block as { text?: unknown }).text;

    return typeof text === "string" ? text : undefined;
};

const resultIsStoredError = (result: ToolResult | [ToolResult]): boolean => {
    const blocks = Array.isArray(result) ? result : [result];

    return blocks.some((block) => {
        const text = getBlockText(block);

        return text !== undefined && PROXY_ERROR_PATTERN.test(text.trim());
    });
};

// Only "empty" when EVERY block is an empty text block - a single empty block alongside a
// non-empty one (or a non-text block, e.g. an image) means the result has real content.
const resultIsEmpty = (result: ToolResult | [ToolResult]): boolean => {
    const blocks = Array.isArray(result) ? result : [result];

    return blocks.every((block) => getBlockText(block)?.trim() === "");
};

/**
 * Header for the whole trace: "Working - Using N tools" / "Done - Used N tools", or, once at
 * least one step has failed, "Used N tools - M failed" with the failed count called out as its
 * own segment (styled in the error color by the UI) instead of a leading "Failed" word.
 */
export const summarizeTrace = (steps: TraceStep[]): TraceSummary => {
    const count = steps.length;
    const noun = count === 1 ? "tool" : "tools";
    let phase: TracePhase = "done";

    if (steps.some((step) => step.status === "running")) phase = "working";
    else if (steps.some((step) => step.status === "error")) phase = "failed";

    if (phase === "working") return { phase, parts: ["Working", `Using ${count} ${noun}`] };

    if (phase === "failed") {
        const failedCount = steps.filter((step) => step.status === "error").length;

        return { phase, parts: [`Used ${count} ${noun}`, `${failedCount} failed`], failedPartIndex: 1 };
    }

    return { phase, parts: ["Done", `Used ${count} ${noun}`] };
};

const getCodeTitle = (status: StepStatus): string => {
    switch (status) {
        case "running":
            return "Executing code...";
        case "empty":
            return "Executed code";
        case "error":
            return "Code execution failed";
        default:
            return "Successfully executed code";
    }
};

const getToolTitle = (toolName: string, status: StepStatus): string => {
    const name = humanizeToolName(toolName);

    if (status === "running") return `${name}...`;
    if (status === "error") return `${name} failed`;

    return name;
};

export const humanizeToolName = (toolName: string): string => {
    const spaced = toolName
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .toLowerCase();

    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const formatDuration = (durationMs: number | undefined): string | undefined => {
    if (durationMs === undefined || !Number.isFinite(durationMs)) return undefined;

    const seconds = durationMs / 1000;

    if (seconds < 60) return `${seconds.toFixed(1)}s`;

    const minutes = Math.floor(seconds / 60);

    return `${minutes}m ${Math.round(seconds % 60)}s`;
};

// `NO_RESULT_DETAILS` doc mirrors ng's step-output text shown when a step errors out without
// ever getting a result; React renders the same message in the Output tab for an error step.
export const NO_RESULT_TEXT = NO_RESULT_DETAILS;
