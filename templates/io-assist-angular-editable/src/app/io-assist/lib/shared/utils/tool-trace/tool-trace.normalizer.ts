import { toRawJson } from "./tool-trace.format";
import { StepStatus, TraceOutput, TracePhase, TraceStep, TraceSummary } from "./tool-trace.types";

/**
 * Pure, framework-free normalizer: turns one tool call - as io-assist stores it after the
 * AG-UI stream (or a fetched thread) - into a TraceStep. It parses payloads (JSON strings,
 * MCP content blocks, code mode's execution envelope) but doesn't reformat them; the UI
 * shows the parsed values as code.
 *
 * What the payloads actually look like by the time they reach io-assist:
 * - A regular tool's `result` is whatever the SDK flattened the MCP result to: the tool's
 *   `structuredContent` object, else its content-block array, else `{ type: "text", text }`
 *   for a non-JSON string. A full CallToolResult (`{ content, structuredContent, isError }`)
 *   is also accepted in case the pipeline starts forwarding it.
 * - `isError` doesn't survive the live stream: a failed tool sends no result at all, so a
 *   step that still has no result once the response has finished is reported as an error.
 *   Fetched threads store the failure as a plain `Error executing proxy tool "...": ...` string.
 * - executeCode returns `{ codeExecutionResult, codeExecutionLogs }`, where the return value
 *   is JSON-stringified inside `codeExecutionResult` ("" for an undefined return).
 */

export type ToolCallInput = {
    id: string;
    toolName: string;
    args?: Record<string, unknown>;
    result?: unknown;
    startedAt?: number;
    completedAt?: number;
};

export type ToolDefinitionInfo = {
    title?: string;
};

export type NormalizeContext = {
    isFinished: boolean;
    getToolDefinition?: (toolName: string) => ToolDefinitionInfo | undefined;
};

export const CODE_TOOL_NAME = "executeCode";
// The only system tool-search method code mode actually exposes.
const TOOL_SEARCH_NAME = "getTools";
const TOOL_DEFINITION_NAME = "getToolDefinition";

const CONTENT_BLOCK_TYPES = new Set(["text", "image", "audio", "resource", "resource_link"]);
const PROXY_ERROR_PATTERN = /^Error (?:executing proxy tool|invoking tool) "?([^":]+)"?:\s*([\s\S]*)$/;

const NO_RESULT_DETAILS = "No result received. The tool may have failed, timed out or been interrupted.";

export const normalizeStep = (call: ToolCallInput, ctx: NormalizeContext): TraceStep => {
    const type = call.toolName === CODE_TOOL_NAME ? "code" : "tool";
    const output = type === "code" ? normalizeCodeOutput(call, ctx) : normalizeToolOutput(call, ctx);
    const durationMs = call.startedAt !== undefined && call.completedAt !== undefined ? Math.max(0, call.completedAt - call.startedAt) : undefined;

    if (type === "code") {
        return {
            id: call.id,
            type,
            title: getCodeTitle(output.status),
            status: output.status,
            durationMs,
            explanation: getStringArg(call.args, "explanation"),
            code: getStringArg(call.args, "code"),
            output,
        };
    }

    return {
        id: call.id,
        type,
        title: getToolTitle(call.toolName, output, ctx.getToolDefinition?.(call.toolName)),
        status: output.status,
        durationMs,
        toolName: call.toolName,
        input: toRawJson(call.args ?? {}),
        output,
    };
};

/**
 * Header for the whole trace: "Working - Using N tools" / "Done - Used N tools", or, once at
 * least one step has failed, "Used N tools - M failed" with the failed count called out as
 * its own segment (styled in the error color by the UI) instead of a leading "Failed" word.
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

const normalizeToolOutput = (call: ToolCallInput, ctx: NormalizeContext): TraceOutput => {
    return getPendingOutput(call, ctx) ?? parseToolPayload(call.result);
};

const normalizeCodeOutput = (call: ToolCallInput, ctx: NormalizeContext): TraceOutput => {
    const pending = getPendingOutput(call, ctx);

    if (pending) return pending;

    const payload = call.result;

    // Fetched threads: the failure is stored as the proxy's error string, which embeds the
    // original { codeExecutionResult, codeExecutionLogs } JSON.
    if (typeof payload === "string") {
        const proxyError = parseProxyError(payload);

        if (proxyError) {
            const inner = tryParseJson(proxyError.details);
            const message = isPlainObject(inner) && typeof inner["codeExecutionResult"] === "string" ? inner["codeExecutionResult"] : proxyError.details;
            const logs = isPlainObject(inner) && typeof inner["codeExecutionLogs"] === "string" ? inner["codeExecutionLogs"] : "";

            return errorOutput([message, logs].filter(Boolean).join("\n"));
        }
    }

    if (isPlainObject(payload) && payload["isError"] === true) return errorOutput(getContentText(payload["content"]));

    // The code's own return value, unwrapped from the execution envelope and parsed.
    if (isPlainObject(payload) && "codeExecutionResult" in payload) {
        const returned = payload["codeExecutionResult"];
        const parsedReturn = typeof returned === "string" ? tryParseJson(returned) : returned;
        const logs = typeof payload["codeExecutionLogs"] === "string" ? payload["codeExecutionLogs"].trim() : "";

        if (!logs) return valueOutput(parsedReturn);

        if (isEmptyValue(parsedReturn)) return { status: "success", text: logs, language: "text", value: logs };

        const resultOutput = valueOutput(parsedReturn);

        return { ...resultOutput, text: `${resultOutput.text}\n\nLogs:\n${logs}`, language: "text" };
    }

    return parseToolPayload(payload);
};

const getPendingOutput = (call: ToolCallInput, ctx: NormalizeContext): TraceOutput | undefined => {
    if (call.result !== undefined && call.result !== null) return undefined;

    if (!ctx.isFinished) return { status: "running", text: "", language: "json", value: undefined };

    return errorOutput(NO_RESULT_DETAILS);
};

/** Parses a regular tool's stored result (see the file header for the shapes it can take). */
const parseToolPayload = (payload: unknown): TraceOutput => {
    if (typeof payload === "string") {
        const proxyError = parseProxyError(payload);

        return proxyError ? errorOutput(proxyError.details) : valueOutput(tryParseJson(payload));
    }

    // Full CallToolResult shape — recognized by a genuine `content` array (the wrapper's
    // signature field) or a `structuredContent` field, NOT just any field named `isError`:
    // a tool's own business result can legitimately carry its own `isError` field (e.g.
    // `{ isError: false, records: [] }`) without being an MCP result wrapper at all. Gating
    // on `isError` alone would wrongly route that object into `parseContentBlocks(undefined)`,
    // which throws on `blocks.length`.
    if (isPlainObject(payload) && (isContentBlockArray(payload["content"]) || payload["structuredContent"] !== undefined)) {
        if (payload["isError"] === true) return errorOutput(getContentText(payload["content"]));

        if (payload["structuredContent"] !== undefined) return valueOutput(payload["structuredContent"]);

        return parseContentBlocks(payload["content"] as PlainBlock[]);
    }

    if (isContentBlock(payload)) return parseContentBlocks([payload]);

    if (isContentBlockArray(payload)) return parseContentBlocks(payload);

    return valueOutput(payload);
};

type PlainBlock = Record<string, unknown> & { type: string };

// A single text block is the common case: its text (parsed if it's JSON) is the real output.
// Several blocks, or non-text blocks (images, resources), are shown as they are.
const parseContentBlocks = (blocks: PlainBlock[]): TraceOutput => {
    if (blocks.length === 1 && blocks[0].type === "text") {
        return valueOutput(tryParseJson(typeof blocks[0]["text"] === "string" ? blocks[0]["text"] : ""));
    }

    return valueOutput(blocks);
};

const valueOutput = (value: unknown): TraceOutput => {
    if (isEmptyValue(value)) return { status: "empty", text: "", language: "json", value };

    if (typeof value === "string") return { status: "success", text: value, language: "text", value };

    return { status: "success", text: toRawJson(value), language: "json", value };
};

const errorOutput = (details: string): TraceOutput => {
    return { status: "error", text: details.trim() || "Error", language: "text", value: undefined };
};

// ---------------------------------------------------------------------------------------
// Titles

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

const getToolTitle = (toolName: string, output: TraceOutput, definition?: ToolDefinitionInfo): string => {
    if (toolName === TOOL_SEARCH_NAME) {
        if (output.status === "running") return "Searching for tools...";
        if (output.status === "error") return "Tool search failed";

        const count = countItems(output.value);

        return count === undefined ? "Found tools" : count === 0 ? "Found no tools" : `Found ${count} ${count === 1 ? "tool" : "tools"}`;
    }

    if (toolName === TOOL_DEFINITION_NAME) {
        if (output.status === "running") return "Getting tool definition...";
        if (output.status === "error") return "Getting tool definition failed";

        return "Got tool definition";
    }

    const name = definition?.title?.trim() || humanizeToolName(toolName);

    if (output.status === "running") return `${name}...`;
    if (output.status === "error") return `${name} failed`;

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

const countItems = (value: unknown): number | undefined => {
    if (Array.isArray(value)) return value.length;

    if (isPlainObject(value)) {
        const firstArray = Object.values(value).find(Array.isArray);

        return firstArray ? firstArray.length : undefined;
    }

    return undefined;
};

// ---------------------------------------------------------------------------------------
// Helpers

type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isContentBlock = (value: unknown): value is PlainBlock => {
    return isPlainObject(value) && typeof value["type"] === "string" && CONTENT_BLOCK_TYPES.has(value["type"]);
};

const isContentBlockArray = (value: unknown): value is PlainBlock[] => {
    return Array.isArray(value) && value.length > 0 && value.every(isContentBlock);
};

// Only structured JSON counts - a bare number/boolean string stays text.
const tryParseJson = (text: string): unknown => {
    const trimmed = text.trim();

    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return text;

    try {
        return JSON.parse(trimmed);
    } catch {
        return text;
    }
};

const parseProxyError = (text: string): { toolName: string; details: string } | undefined => {
    const match = PROXY_ERROR_PATTERN.exec(text.trim());

    return match ? { toolName: match[1], details: match[2].trim() } : undefined;
};

const getContentText = (content: unknown): string => {
    if (typeof content === "string") return content;

    if (Array.isArray(content)) {
        return content
            .map((block) => (isPlainObject(block) && typeof block["text"] === "string" ? block["text"] : ""))
            .filter(Boolean)
            .join("\n");
    }

    return "";
};

const getStringArg = (args: Record<string, unknown> | undefined, key: string): string | undefined => {
    const value = args?.[key];

    return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

const isEmptyValue = (value: unknown): boolean => {
    if (value === undefined || value === null) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    if (isPlainObject(value)) return Object.keys(value).length === 0;

    return false;
};
