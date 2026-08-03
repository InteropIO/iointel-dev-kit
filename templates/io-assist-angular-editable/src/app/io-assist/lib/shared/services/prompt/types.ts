import { IconResource } from "../../../io-assist.types";

export type Unsubscribe = () => void;

export type Prompt = {
    name: string;
    messages: { role: "user" | "assistant"; content: { type: "text"; text: string } }[];
    source?: {
        mcpName: string;
        isUserDefined?: boolean;
    };
    description?: string;
    metadata?: Record<string, unknown>;
};

export type UIPrompt = Prompt & {
    category?: string;
    icon?: IconResource;
};
