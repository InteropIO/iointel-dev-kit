import type { IoAiWeb } from "@interopio/ai-web";

export type GetResponseParams = {
    messages: IoAiWeb.Agents.AgentMessage[];
    instructions?: string;
    system?: string;
    memory?: {
        thread: string;
        resource: string;
    };
    modelSettings?: {
        maxTokens?: number;
        temperature?: number;
    };
};

export const RESPONSE_STREAM_STATUS = {
    IDLE: "idle",
    STREAMING: "streaming",
    COMPLETED: "completed",
    ERROR: "error",
    ABORTED: "aborted",
} as const;

export type ResponseStreamStatus = (typeof RESPONSE_STREAM_STATUS)[keyof typeof RESPONSE_STREAM_STATUS];
