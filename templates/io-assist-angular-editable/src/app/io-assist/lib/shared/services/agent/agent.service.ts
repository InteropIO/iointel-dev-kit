/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, Injectable, Signal } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";

import { IO_ASSIST_DYNAMIC_CONFIG } from "../../../io-assist.config";
import { AgentFacade } from "../../store/agent/agent.facade";
import { GetResponseParams } from "../../store/message/types";
import { ThreadFacade } from "../../store/thread/thread.facade";
import { LoggerService } from "../logger/logger.service";

@Injectable({
    providedIn: "root",
})
export class AgentService {
    private readonly _agentFacade: AgentFacade = inject(AgentFacade);
    private readonly _theadFacade: ThreadFacade = inject(ThreadFacade);
    private readonly _logger: LoggerService = inject(LoggerService);
    private readonly _dynamicConfig = inject(IO_ASSIST_DYNAMIC_CONFIG);
    protected readonly LOGGER_NAME: string = "AgentService";

    private readonly _selectedAgent: Signal<IoAiWeb.Agents.Agent | null> = this._agentFacade.selectedAgent;
    private readonly _activeThreadId: Signal<string | null> = this._theadFacade.activeThreadId;

    public getResponse(params: GetResponseParams, isStream: boolean = true, agent?: IoAiWeb.Agents.Agent, skipThreadManagement: boolean = false, autoIncludeTools: boolean = true): Promise<any> {
        if (!agent) {
            agent = this._selectedAgent() ?? undefined;
        }

        if (!agent) {
            return Promise.reject(new Error("No agent available for response generation"));
        }

        const responseParams: GetResponseParams = this.constructParams(params, skipThreadManagement);

        const streamParams = this.toStreamParams(responseParams, autoIncludeTools);

        return isStream ? agent.stream(streamParams) : agent.generate(streamParams);
    }

    public getSamplingResponse(params: GetResponseParams, skipThreadManagement: boolean = false): Promise<any> {
        return this.getResponse(params, false, undefined, skipThreadManagement, false);
    }

    public reloadResponse(params: GetResponseParams, isStream: boolean = true, agent?: IoAiWeb.Agents.Agent, skipThreadManagement: boolean = false): Promise<any> {
        return this.getResponse(params, isStream, agent, skipThreadManagement);
    }

    public getSelectedAgentModelId(): string {
        return this._selectedAgent()?.modelId ?? "unknown";
    }

    public abortOperation(threadId: string): void {
        const selectedAgent: IoAiWeb.Agents.Agent | null = this._selectedAgent();

        if (!selectedAgent) {
            throw new Error("No agent available to abort operation");
        }

        selectedAgent.abortOperation(threadId);
    }

    private toStreamParams(params: GetResponseParams, autoIncludeTools = true): IoAiWeb.Agents.StreamParams {
        const messages: IoAiWeb.Agents.AgentMessage[] = Array.isArray(params.messages)
            ? params.messages.map((msg) => ({
                  id: msg.id,
                  role: msg.role as IoAiWeb.Agents.AgentMessage["role"],
                  content: msg.content ?? "",
              }))
            : [];

        return {
            messages,
            memory: params.memory,
            resourceId: params.memory?.resource,
            ...(params.structuredOutput ? { structuredOutput: params.structuredOutput } : {}),
            tools: { autoIncludeEnabled: autoIncludeTools },
        };
    }

    private constructParams(params: GetResponseParams, skipThreadManagement: boolean): GetResponseParams {
        // Filter out assistant messages with empty/whitespace-only content
        // This prevents "text content blocks must be non-empty" errors from Anthropic
        const filteredMessages = Array.isArray(params.messages)
            ? params.messages.filter((msg) => {
                  // Keep all non-assistant messages
                  if (msg.role !== "assistant") {
                      return true;
                  }

                  // For assistant messages, only keep if content is non-empty
                  const content = msg.content;
                  return content && typeof content === "string" && content.trim() !== "";
              })
            : params.messages;

        const filteredParams = { ...params, messages: filteredMessages };

        const currentUser: string = this._dynamicConfig().user.id;
        const activeThreadId: string | null = this._activeThreadId();

        if (skipThreadManagement) {
            // Sampling and other skip-thread-management requests must NOT inherit
            // the active thread — doing so would pollute the main conversation
            // history with unrelated messages (see db-problem.md, Problem 3).
            // Only use memory if the caller explicitly provides both thread and resource.
            const thread = filteredParams.memory?.thread ?? undefined;
            const resource = filteredParams.memory?.resource ?? undefined;

            return {
                ...filteredParams,
                ...(thread && resource ? { memory: { thread, resource } } : {}),
            };
        }

        if (!activeThreadId) {
            this._logger.get(this.LOGGER_NAME).info("No active thread ID found, generating a new one.");

            const newThreadId = crypto.randomUUID();

            this._theadFacade.dispatchChangeActiveThread(newThreadId);

            return {
                ...filteredParams,
                memory: {
                    thread: newThreadId,
                    resource: currentUser,
                },
            };
        }

        return {
            ...filteredParams,
            memory: {
                thread: activeThreadId,
                resource: currentUser,
            },
        };
    }
}
