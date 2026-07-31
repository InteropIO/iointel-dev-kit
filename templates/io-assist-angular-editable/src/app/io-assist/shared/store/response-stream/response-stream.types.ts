import { UIMessage, UIToolMessage } from "../message/types";

export enum RESPONSE_STREAM_STATUS {
    IDLE = "idle",
    STREAMING = "streaming",
    COMPLETED = "completed",
    ERROR = "error",
    ABORTED = "aborted",
}

export type ThreadStreamState = {
    threadId: string;
    status: RESPONSE_STREAM_STATUS;
    accumulatedContent: string;
    /** Current assistant message ID being streamed */
    currentMessageId: string | null;
    // only if user is not on the thread when stream completes
    hasCompletionNotification: boolean;
    errorMessage?: string;
    userMessage: UIMessage | null;
    toolMessages: UIToolMessage[];
};

export function createThreadStreamState(threadId: string, status: RESPONSE_STREAM_STATUS = RESPONSE_STREAM_STATUS.IDLE, userMessage: UIMessage | null = null): ThreadStreamState {
    return {
        threadId,
        status,
        accumulatedContent: "",
        currentMessageId: null,
        hasCompletionNotification: false,
        userMessage,
        toolMessages: [],
    };
}
