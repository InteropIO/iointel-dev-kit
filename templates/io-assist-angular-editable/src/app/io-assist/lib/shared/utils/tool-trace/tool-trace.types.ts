export type StepType = "tool" | "code";
export type StepStatus = "running" | "success" | "empty" | "error";
export type TraceCodeLanguage = "json" | "javascript" | "text";

export type TraceStep = {
    id: string;
    type: StepType;
    title: string;
    status: StepStatus;
    durationMs?: number;
    toolName?: string;
    explanation?: string;
    code?: string;
    input?: string;
    output: TraceOutput;
};

export type TraceOutput = {
    status: StepStatus;
    text: string;
    language: TraceCodeLanguage;
    value: unknown;
};

export type TracePhase = "working" | "failed" | "done";

export type TraceSummary = {
    phase: TracePhase;
    parts: string[];
    failedPartIndex?: number;
};
