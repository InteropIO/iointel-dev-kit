import type { IoAiWeb } from "@interopio/ai-web";
import { useMemo } from "react";

import { abortActiveStream } from "../actions/abortActiveStream";
import { deleteThread } from "../actions/deleteThread";
import { newConversation } from "../actions/newConversation";
import { renameThread } from "../actions/renameThread";
import { selectThread } from "../actions/selectThread";
import { sendUserMessage } from "../actions/sendUserMessage";
import { toggleTool } from "../actions/toggleTool";
import { useIoAssistStore, useIoAssistDynamicConfig } from "../context/IoAssistContext";
import { ioAssistStore } from "../stores";

export type UseIoAiWebApi = {
    api: IoAiWeb.API | null;
    isReady: boolean;
    sendMessage: (text: string) => Promise<void>;
    abortMessage: () => void;
    newConversation: () => Promise<void>;
    selectThread: (threadId: string) => Promise<void>;
    renameThread: (threadId: string, title: string) => Promise<void>;
    deleteThread: (threadId: string) => Promise<void>;
    toggleTool: (name: string, enabled: boolean) => Promise<void>;
};

/**
 * Accessor hook for the IoAiWeb SDK instance with the most-used
 * orchestrations baked in. Pairs with `useIoAiWebBootstrap()` which
 * boots the SDK once at the app root.
 *
 */
export function useIoAiWebApi(): UseIoAiWebApi {
    const api = useIoAssistStore((s) => s.ioAiWebApi);
    const dynamicConfig = useIoAssistDynamicConfig();

    return useMemo<UseIoAiWebApi>(
        () => ({
            api,
            isReady: api !== null,
            sendMessage: (text) => sendUserMessage(ioAssistStore, text, dynamicConfig),
            abortMessage: () => abortActiveStream(ioAssistStore),
            newConversation: () => newConversation(ioAssistStore),
            selectThread: (id) => selectThread(ioAssistStore, id),
            renameThread: (id, title) => renameThread(ioAssistStore, id, title),
            deleteThread: (id) => deleteThread(ioAssistStore, id),
            toggleTool: (name, enabled) => toggleTool(ioAssistStore, name, enabled),
        }),
        [api, dynamicConfig]
    );
}
