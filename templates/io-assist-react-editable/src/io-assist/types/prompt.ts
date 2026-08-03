import type { IconResource } from "./icon";

export type IoAssistPrompt = {
    name: string;
    prompt: string;
    iconResource?: IconResource;
};

export type IoAssistPromptCategory = {
    category?: string;
    prompts: IoAssistPrompt[];
};

export type Prompt = {
    id: string;
    name: string;
    description: string;
    category?: string;
    iconResource?: IconResource;
};
