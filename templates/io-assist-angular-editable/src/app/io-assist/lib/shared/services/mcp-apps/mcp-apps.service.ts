import { inject, Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { IOConnectCore } from "@interopio/core";
import { Store } from "@ngrx/store";

import { APP_BUTTON_TYPES } from "../../components/app-button/enum";
import { PANEL_BUTTON_ACTION_TYPE } from "../../components/app-panel/enums";
import { UI_STRINGS } from "../../constants/ui-strings";
import { getResponse } from "../../store/message/message.actions";
import { UI_MESSAGE_ROLES } from "../../store/message/types";
import { selectActiveThreadId } from "../../store/thread/thread.selector";
import { IOConnectService } from "../io/io.service";
import { LoggerService } from "../logger/logger.service";
import { OverlayService } from "../overlay/overlay.service";

/**
 * Centralized service for all MCP Apps interactions in io-assist.
 *
 * Manages:
 * - availability check (mcpApps is only present when configured)
 * - instance tracking (signal-based for Angular reactivity)
 * - per-instance chat-message subscriptions
 * - replace-instance modal delegation
 * - event wiring (onAppCreated / onRecreateRequested / onAppRecreated)
 */
@Injectable({
    providedIn: "root",
})
export class McpAppsService {
    private readonly _ioConnectService: IOConnectService = inject(IOConnectService);
    private readonly _overlayService: OverlayService = inject(OverlayService);
    private readonly _store: Store = inject(Store);
    private readonly _loggerService: LoggerService = inject(LoggerService);

    private readonly _activeThreadId: Signal<string | null> = this._store.selectSignal(selectActiveThreadId);

    private _api: IoAiWeb.McpApps.API | undefined;

    private readonly _instances: WritableSignal<IoAiWeb.McpApps.AppInstance[]> = signal([]);
    private readonly _unsubs: (() => void)[] = [];
    private readonly _chatMessageUnsubs = new Map<string, () => void>();

    /**
     * When true, a replace-instance modal is already visible.
     * Subsequent recreate requests during the same stream auto-resolve
     * as "replace" to avoid stacking multiple dialogs.
     */
    private _isRecreateModalOpen = false;

    /** Whether MCP Apps are available in the current session. */
    public get isAvailable(): boolean {
        return this._api !== undefined;
    }

    /** Reactive list of tracked MCP App instances. */
    public get instances(): Signal<IoAiWeb.McpApps.AppInstance[]> {
        return this._instances;
    }

    /**
     * Called once during IOIntelWebService.initialize() — wires event
     * subscriptions if the mcpApps namespace exists on the API.
     */
    public attach(intelWebApi: IoAiWeb.API): void {
        if (!intelWebApi.mcpApps) return;

        this._api = intelWebApi.mcpApps;

        const unsubCreated = this._api.onAppCreated((app) => {
            const activeThread = this._activeThreadId();
            if (activeThread && app.threadId !== activeThread) return;

            this._instances.update((prev) => [...prev, app]);
            this._subscribeToChatMessages(app);
        });

        const unsubRecreate = this._api.onRecreateRequested((event) => {
            // When a modal is already open (e.g. LLM called the same tool 5 times),
            // auto-select "replace" for subsequent events to avoid stacking dialogs.
            if (this._isRecreateModalOpen) {
                event.select("recreate").catch(() => this._logger().warn("Failed to auto-select 'recreate' on mcpApps recreate request"));
                return;
            }

            this._isRecreateModalOpen = true;
            this._showReplaceInstanceModal(event.toolName)
                .then((replace) => event.select(replace ? "recreate" : "newInstance"))
                .catch(() => {
                    this._logger().warn("Failed to select option on mcpApps recreate request — defaulting to recreate");
                    event.select("recreate").catch(() => undefined);
                })
                .finally(() => {
                    this._isRecreateModalOpen = false;
                });
        });

        const unsubRecreated = this._api.onAppRecreated((event) => {
            this._instances.update((prev) => {
                const filtered = prev.filter((a) => a.id !== event.oldId);
                // The new app is already added by onAppCreated — no need to push here.
                return filtered;
            });
            // Clean up the old instance's chat-message subscription.
            const oldUnsub = this._chatMessageUnsubs.get(event.oldId);
            if (oldUnsub) {
                oldUnsub();
                this._chatMessageUnsubs.delete(event.oldId);
            }
        });

        this._unsubs.push(unsubCreated, unsubRecreate, unsubRecreated);
    }

    /** Clears tracked instances and tears down per-instance chat-message subscriptions. */
    public resetInstances(): void {
        this._chatMessageUnsubs.forEach((unsub) => unsub());
        this._chatMessageUnsubs.clear();
        this._instances.set([]);
    }

    /** Closes all active proxy windows and resets to accept new instances. No-ops when mcpApps is not configured. */
    public async closeAll(): Promise<void> {
        if (!this._api) return;

        await this._api.closeAll();
    }

    /**
     * Creates MCP App instances for a thread (used on thread switch to restore apps).
     * No-ops when mcpApps is not configured.
     */
    public async createApps(params: IoAiWeb.McpApps.CreateParams): Promise<void> {
        if (!this._api) return;

        await this._api.create(params);
    }

    /**
     * Atomically closes all existing MCP App instances and creates new ones.
     * Prevents race conditions when rapidly switching threads.
     * No-ops when mcpApps is not configured.
     */
    public async recreate(params: IoAiWeb.McpApps.CreateParams): Promise<void> {
        if (!this._api) return;

        await this._api.recreate(params);
    }

    /** Forwards response-pending status to all active MCP App instances. */
    public notifyPendingResponse(isPending: boolean): void {
        this._api?.notifyPendingResponse(isPending);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private _subscribeToChatMessages(app: IoAiWeb.McpApps.AppInstance): void {
        const unsub = app.onMessage((text) => {
            const activeThreadId = this._activeThreadId();
            if (!activeThreadId) return;

            this._store.dispatch(
                getResponse({
                    params: {
                        messages: [
                            {
                                id: crypto.randomUUID(),
                                role: UI_MESSAGE_ROLES.USER,
                                content: text,
                            },
                        ],
                    },
                    threadId: activeThreadId,
                })
            );
        });

        this._chatMessageUnsubs.set(app.id, unsub);
    }

    private async _showReplaceInstanceModal(toolName: string): Promise<boolean> {
        const strings = UI_STRINGS.MCP_APP_REPLACE_MODAL;

        const ioModalResult = await this._tryIoConnectModal(strings, toolName);
        if (ioModalResult !== null) return ioModalResult;

        return this._showFallbackOverlay(strings, toolName);
    }

    private async _tryIoConnectModal(strings: typeof UI_STRINGS.MCP_APP_REPLACE_MODAL, toolName: string): Promise<boolean | null> {
        const isAvailable = await this._ioConnectService.isModalsAvailable().catch(() => false);
        if (!isAvailable) return null;

        try {
            const response = await this._ioConnectService.requestModalDialog({
                templateName: "noInputsConfirmationDialog",
                variables: {
                    title: strings.TITLE,
                    heading: strings.HEADING,
                    text: strings.TEXT(toolName),
                    actionButtons: [
                        { variant: "primary", text: strings.REPLACE_BUTTON, id: "replace" },
                        { variant: "outline", text: strings.NEW_INSTANCE_BUTTON, id: "new" },
                    ],
                },
            });

            return response?.responseButtonClicked?.id === "replace";
        } catch {
            return null;
        }
    }

    private _escapeHtml(str: string): string {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    private _showFallbackOverlay(strings: typeof UI_STRINGS.MCP_APP_REPLACE_MODAL, toolName: string): Promise<boolean> {
        const escapedToolName = this._escapeHtml(toolName);

        return new Promise<boolean>((resolve) => {
            this._overlayService.showPanelOverlay({
                title: strings.TITLE,
                content: `<div class="flex flex-col g-2">
                            <span class="text-text-black-white text-lg">${strings.HEADING}</span>
                            <span class="text-text-default text-sm">${strings.TEXT(escapedToolName)}</span>
                          </div>`,
                isHeaderCloseButtonDisplayed: false,
                footerButtons: [
                    {
                        label: strings.REPLACE_BUTTON,
                        action: PANEL_BUTTON_ACTION_TYPE.CUSTOM,
                        type: APP_BUTTON_TYPES.SUBMIT,
                        onClick: () => {
                            this._overlayService.closeCurrentOverlay();
                            resolve(true);
                        },
                    },
                    {
                        label: strings.NEW_INSTANCE_BUTTON,
                        action: PANEL_BUTTON_ACTION_TYPE.CUSTOM,
                        type: APP_BUTTON_TYPES.DEFAULT,
                        onClick: () => {
                            this._overlayService.closeCurrentOverlay();
                            resolve(false);
                        },
                    },
                ],
            });
        });
    }

    private _logger(): IOConnectCore.Logger.API {
        return this._loggerService.get("McpAppsService");
    }
}
