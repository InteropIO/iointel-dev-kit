import { CommonModule } from "@angular/common";
import { Component, computed, ElementRef, inject, Signal, viewChild } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";

import { AppSpinnerComponent } from "../../../shared/components/app-spinner/app-spinner.component";
import { APP_SPINNER_COMPONENT_SIZE } from "../../../shared/components/app-spinner/enum";
import { McpAppsService } from "../../../shared/services/mcp-apps/mcp-apps.service";
import { MessageFacade } from "../../../shared/store/message/message.facade";
import { ToolTraceState, UI_MESSAGE_ROLES, UIMessage } from "../../../shared/store/message/types";
import { ScrollAreaComponent } from "../../scroll-area/scroll-area.component";
import { AssistantMessageComponent } from "../assistant-message/assistant-message.component";
import { McpAppResourceComponent } from "../mcp-app-resource/mcp-app-resource.component";
import { ToolTraceMessageComponent } from "../tool-trace-message/tool-trace-message.component";
import { UserMessageComponent } from "../user-message/user-message.component";

const COMPONENTS = [ScrollAreaComponent, AssistantMessageComponent, UserMessageComponent, AppSpinnerComponent, ToolTraceMessageComponent, McpAppResourceComponent];
const MODULES = [CommonModule];

@Component({
    selector: "message-area",
    templateUrl: "./message-area.component.html",
    imports: [...COMPONENTS, ...MODULES],
})
export class MessageAreaComponent {
    protected readonly UI_MESSAGE_ROLES = UI_MESSAGE_ROLES;
    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;

    protected readonly messageAreaRef: Signal<ElementRef | undefined> = viewChild<ElementRef | undefined>("messageArea");

    private readonly _messageFacade: MessageFacade = inject(MessageFacade);
    private readonly _mcpAppsService: McpAppsService = inject(McpAppsService);

    protected readonly allMessages: Signal<UIMessage[]> = this._messageFacade.allMessages;
    protected readonly isLoadingMessagesFromThread: Signal<boolean> = this._messageFacade.isLoadingMessagesFromThread;
    protected readonly isSuccessFetchedFromThread: Signal<boolean> = this._messageFacade.isSuccessFetchedFromThread;
    protected readonly isLastUserMessage: Signal<boolean> = this._messageFacade.isLastUserMessage;
    protected readonly toolTraceState: Signal<ToolTraceState[]> = this._messageFacade.toolTraceState;

    /**
     * Maps each responseForUserQueryId to the list of MCP App instances
     * associated with tool calls from that response cycle.
     * Re-evaluates whenever instances or messages change.
     */
    protected readonly mcpAppsByResponse: Signal<Map<string, IoAiWeb.McpApps.AppInstance[]>> = computed(() => {
        const instances = this._mcpAppsService.instances();
        const messages = this.allMessages();
        const map = new Map<string, IoAiWeb.McpApps.AppInstance[]>();

        for (const msg of messages) {
            if (msg.role !== UI_MESSAGE_ROLES.TOOL) continue;
            const instance = instances.find((i) => i.id === msg.id);
            if (!instance || !msg.responseForUserQueryId) continue;

            const key = msg.responseForUserQueryId;
            const list = map.get(key) ?? [];
            list.push(instance);
            map.set(key, list);
        }

        return map;
    });

    protected getMcpAppsForResponse(responseForUserQueryId: string | undefined): IoAiWeb.McpApps.AppInstance[] {
        if (!responseForUserQueryId) return [];
        return this.mcpAppsByResponse().get(responseForUserQueryId) ?? [];
    }

    protected showToolTraceForMessage(messageId: string): boolean {
        return this.toolTraceState().some((state: ToolTraceState) => state.stateForMessageId === messageId && state.executedTools.length > 0);
    }
}
