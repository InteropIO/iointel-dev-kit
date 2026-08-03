export type GetResponseParams = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: UIMessage[] | any[];
    instructions?: string;
    system?: string;
    memory?: {
        thread: string;
        resource: string;
    };
    modelSettings?: {
        maxTokens?: number;
        temperature?: number;
        topP?: number;
        topK?: number;
        maxRetries?: number;
    };
    requestContext?: Record<string, unknown>;
    structuredOutput?: {
        schema?: Record<string, unknown> | string;
    };
};

export enum UI_MESSAGE_PART_TYPES {
    TEXT = "text",
    TOOL_INVOCATION = "tool-invocation",
    STEP_START = "step-start",
}

export enum UI_MESSAGE_ROLES {
    USER = "user",
    ASSISTANT = "assistant",
    TOOL = "tool",
}

export enum TOOL_RESULT_TYPES {
    TEXT = "text",
    IMAGE = "image",
    AUDIO = "audio",
}

export type UIMessageType = UI_MESSAGE_ROLES.USER | UI_MESSAGE_ROLES.ASSISTANT | UI_MESSAGE_ROLES.TOOL;

export type UIMessageBase = {
    id: string;
    role: UIMessageType;
    content?: string;
    displayFooter?: boolean;
    responseForUserQueryId?: string;
    isLastMessage?: boolean;
    isNew?: boolean;
};

export type UIUserMessage = UIMessageBase & {
    role: UI_MESSAGE_ROLES.USER;
};

export type UIAssistantMessage = UIMessageBase & {
    role: UI_MESSAGE_ROLES.ASSISTANT;
};

export type UIToolMessage = UIMessageBase & {
    toolName: string;
    role: UI_MESSAGE_ROLES.TOOL;
    args?: Record<string, unknown>;
    result?: ToolResult | [ToolResult];
    isExpanded?: boolean;
};

export type ToolTextResult = {
    type: TOOL_RESULT_TYPES.TEXT;
    text: string;
};

export type ToolImageResult = {
    type: TOOL_RESULT_TYPES.IMAGE;
    data: string; // base64-encoded image data
    mimeType: string; // TODO: more explicit mime type enum when we support multiple image types
};

export type ToolAudioResult = {
    type: TOOL_RESULT_TYPES.AUDIO;
    data: string; // base64-encoded audio data
    mimeType: string; // TODO: more explicit mime type enum when we support audio
};

export type ToolTraceState = {
    stateForMessageId: string;
    executedTools: UIToolMessage[];
    uiMessage: string;
    isExpanded?: boolean;
    displayFooter?: boolean;
    responseForUserQueryId?: string;
};

export type ToolResult = ToolTextResult | ToolImageResult | ToolAudioResult;

export type UIResponseMessage = UIAssistantMessage | UIToolMessage | UIUserMessage;

export type UIMessage = UIUserMessage | UIResponseMessage;
