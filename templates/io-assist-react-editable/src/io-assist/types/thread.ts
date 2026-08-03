import type { IoAiWeb } from "@interopio/ai-web";

export type UIThread = {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt?: Date;
    rawThread: IoAiWeb.Threads.Thread;
    update(params: { title: string }): Promise<void>;
    delete(): Promise<void>;
    getMessages(params: { limit: number }): Promise<IoAiWeb.Threads.GetMessagesResponse>;
};
