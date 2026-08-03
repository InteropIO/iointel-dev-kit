import type { IoAiWeb } from "@interopio/ai-web";

import type { IoAssistStoreInstance } from "../stores";
import type { IoAssistDynamicConfig } from "../types";
import { sendUserMessage } from "./sendUserMessage";
import { logger } from "../utils/logger";
import { showMcpAppReplaceModal } from "../utils/mcpAppModal";
import { safeStringify } from "../utils/safeStringify";

const LOGGER_NAME = "McpAppEvents";
const log = logger.get(LOGGER_NAME);

type AppInstance = IoAiWeb.McpApps.AppInstance;

export function wireMcpAppEvents(ioIntelWeb: IoAiWeb.API, store: IoAssistStoreInstance, dynamicConfig: IoAssistDynamicConfig): void {
    if (!ioIntelWeb.mcpApps) {
        log.warn("ioIntelWeb.mcpApps is not available — MCP app + recreate prompt will not work. Check the mcpApps config + sandboxProxyUrl.");
        return;
    }

    log.debug(
        `Wiring MCP app handlers: ${safeStringify({
            hasOnAppCreated: typeof ioIntelWeb.mcpApps.onAppCreated === "function",
            hasOnRecreateRequested: typeof ioIntelWeb.mcpApps.onRecreateRequested === "function",
            hasOnAppRecreated: typeof ioIntelWeb.mcpApps.onAppRecreated === "function",
        })}`
    );

    let recreateModalOpen = false;
    // Per-app onMessage unsubscribers so we can clean up on recreate.
    const chatMessageUnsubs = new Map<string, () => void>();

    ioIntelWeb.mcpApps.onAppCreated((app: AppInstance) => {
        log.debug(`mcpApps.onAppCreated: ${safeStringify({ id: app?.id, threadId: app?.threadId, hasElement: !!app?.element, hasOnMessage: typeof app?.onMessage === "function" })}`);
        const activeThreadId = store.getState().activeThreadId;
        if (activeThreadId && app.threadId !== activeThreadId) return;
        store.getState().addMcpApp(app);
        subscribeAppToChat(app, store, dynamicConfig, chatMessageUnsubs);
    });

    ioIntelWeb.mcpApps.onRecreateRequested((event: IoAiWeb.McpApps.RecreateRequestEvent) => {
        log.debug(`mcpApps.onRecreateRequested fired: ${safeStringify({ toolName: event?.toolName, hasSelect: typeof event?.select === "function" })}`);
        // While a recreate prompt is already on screen, auto-select 'recreate'
        // for subsequent events so dialogs don't stack (mirrors Angular).
        if (recreateModalOpen) {
            event.select("recreate").catch(() => undefined);
            return;
        }
        recreateModalOpen = true;

        showMcpAppReplaceModal(event.toolName ?? "this app")
            .then((choice) => event.select(choice))
            .catch(() => event.select("recreate").catch(() => undefined))
            .finally(() => {
                recreateModalOpen = false;
            });
    });

    ioIntelWeb.mcpApps.onAppRecreated((event: IoAiWeb.McpApps.AppRecreatedEvent) => {
        store.getState().removeMcpApp(event.oldId);
        const oldUnsub = chatMessageUnsubs.get(event.oldId);
        if (oldUnsub) {
            try {
                oldUnsub();
            } catch {
                /* noop */
            }
            chatMessageUnsubs.delete(event.oldId);
        }
    });
}

function subscribeAppToChat(app: AppInstance, store: IoAssistStoreInstance, dynamicConfig: IoAssistDynamicConfig, unsubs: Map<string, () => void>): void {
    if (typeof app?.onMessage !== "function") {
        log.warn(`MCP app instance has no onMessage method: ${safeStringify({ id: app?.id })}`);
        return;
    }

    const unsub = app.onMessage((text: string) => {
        log.debug(`MCP app sent chat message: ${safeStringify({ appId: app.id, text })}`);
        const activeThreadId = store.getState().activeThreadId;
        if (!activeThreadId) return;
        if (app.threadId && app.threadId !== activeThreadId) return;
        // Forward as a user message and stream the response — same as the
        // user typing into the input area.
        void sendUserMessage(store, text, dynamicConfig);
    });

    unsubs.set(app.id, unsub);
}
