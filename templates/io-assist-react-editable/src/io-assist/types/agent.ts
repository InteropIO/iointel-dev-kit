import type { IoAiWeb } from "@interopio/ai-web";

export type UIAgent = {
    id: string;
    name: string;
    description?: string;
    modelId?: string;
    rawAgent: IoAiWeb.Agents.Agent;
};
