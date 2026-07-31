export const UI_MESSAGE_ROLES = {
    USER: "user",
    ASSISTANT: "assistant",
    TOOL: "tool",
} as const;

export type UIMessageRole = (typeof UI_MESSAGE_ROLES)[keyof typeof UI_MESSAGE_ROLES];

export const TOOL_RESULT_TYPES = {
    TEXT: "text",
    IMAGE: "image",
    AUDIO: "audio",
} as const;

export type ToolResultType = (typeof TOOL_RESULT_TYPES)[keyof typeof TOOL_RESULT_TYPES];

export type UIMessageBase = {
    id: string;
    role: UIMessageRole;
    content?: string;
    displayFooter?: boolean;
    responseForUserQueryId?: string;
    isLastMessage?: boolean;
    isNew?: boolean;
};

export type UIUserMessage = UIMessageBase & {
    role: typeof UI_MESSAGE_ROLES.USER;
};

export type UIAssistantMessage = UIMessageBase & {
    role: typeof UI_MESSAGE_ROLES.ASSISTANT;
};

export type ToolTextResult = { type: typeof TOOL_RESULT_TYPES.TEXT; text: string };
export type ToolImageResult = {
    type: typeof TOOL_RESULT_TYPES.IMAGE;
    data: string;
    mimeType: string;
};
export type ToolAudioResult = {
    type: typeof TOOL_RESULT_TYPES.AUDIO;
    data: string;
    mimeType: string;
};
export type ToolResult = ToolTextResult | ToolImageResult | ToolAudioResult;

export type UIToolMessage = UIMessageBase & {
    toolName: string;
    role: typeof UI_MESSAGE_ROLES.TOOL;
    args?: Record<string, unknown>;
    result?: ToolResult | [ToolResult];
    isExpanded?: boolean;
};

export type UIMessage = UIUserMessage | UIAssistantMessage | UIToolMessage;

export type ToolTraceState = {
    stateForMessageId: string;
    executedTools: UIToolMessage[];
    uiMessage: string;
    isExpanded?: boolean;
};
