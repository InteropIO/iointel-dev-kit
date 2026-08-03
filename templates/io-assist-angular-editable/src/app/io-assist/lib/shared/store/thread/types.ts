import { IoAiWeb } from "@interopio/ai-web";

import { THREAD_STATE } from "./enums";

export type ThreadState = THREAD_STATE.IDLE | THREAD_STATE.RENAMING | THREAD_STATE.DELETING;

export type UIThread = IoAiWeb.Threads.Thread & {
    id: string;
    title: string;
    metadata?: Record<string, unknown>;
    updatedAt?: Date;
    state?: ThreadState;
};
