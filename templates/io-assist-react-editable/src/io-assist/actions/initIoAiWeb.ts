// SDK adapter: initialises IoAiWeb after io.Connect is ready, then runs the
// post-init data loaders (agents, threads, prompts, tools, working context).
// This module mutates the store via `store.getState().setX()` — selectors are
// reserved for render-coupled reads in the React tree.

import type { IoAiWeb } from "@interopio/ai-web";
import type { IoIntelWorkingContext } from "@interopio/working-context";

import type { IoAssistStoreInstance } from "../stores";
import { LOADING_STATES, TOOL_STATES } from "../types";
import type { IoAssistDynamicConfig, IoAssistPrompt, IoAssistPromptCategory, IoAssistStaticConfig, Prompt, UIAgent, UIThread, UITool } from "../types";
import { selectElicitation } from "./elicitation";
import { wireMcpAppEvents } from "./mcpAppEvents";
import { selectSampling } from "./sampling";
import { logger } from "../utils/logger";

const LOGGER_NAME = "InitIoAiWeb";
const log = logger.get(LOGGER_NAME);

export async function initIoAiWeb(staticConfig: IoAssistStaticConfig, dynamicConfig: IoAssistDynamicConfig, store: IoAssistStoreInstance): Promise<void> {
    try {
        const { IoAiWebFactory } = await import("@interopio/ai-web");

        const ioApi = store.getState().ioConnectApi;
        if (!ioApi) throw new Error("io.Connect API not available");

        const webConfig = buildWebConfig(staticConfig, dynamicConfig);

        const ioIntelWeb = await IoAiWebFactory(ioApi, webConfig);

        log.info("IoAiWeb initialised successfully.");

        // Expose globally for debugging
        // (window as Window & { intel?: IoAiWeb.API }).intel = ioIntelWeb;

        const state = store.getState();
        state.setIoAiWebApi(ioIntelWeb);
        state.setAppLoadingState({ type: LOADING_STATES.SUCCESS });

        // Wire MCP app lifecycle events synchronously after init (mirrors Angular's
        // McpAppsService.attach()) so we don't miss any events that fire before
        // the post-init Promise.all() resolves.
        wireMcpAppEvents(ioIntelWeb, store, dynamicConfig);

        const userId = dynamicConfig.user.id ?? "";

        // Post-init tasks
        await Promise.all([
            listAgents(ioIntelWeb, staticConfig.defaultAgentName, userId, store),
            loadPrompts(staticConfig.defaultPrompts ?? [], store),
            loadTools(ioIntelWeb, store),
            checkWorkingContext(ioIntelWeb, store),
        ]);

        const toolsApi = ioIntelWeb.tools as IoAiWeb.Tools.API & {
            onChanged?: (cb: () => void) => void;
        };
        if (typeof toolsApi.onChanged === "function") {
            toolsApi.onChanged(() => {
                loadTools(ioIntelWeb, store);
            });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to initialise IO Intel Web API";

        store.getState().setAppLoadingState({ type: LOADING_STATES.ERROR, message });
        log.error("IoAiWeb initialisation failed.", error instanceof Error ? error : new Error(String(error)));
    }
}

function buildWebConfig(staticConfig: IoAssistStaticConfig, dynamicConfig: IoAssistDynamicConfig): IoAiWeb.WebConfig {
    const agentServer: IoAiWeb.AgentServerConfig = {
        ...staticConfig.aiWebConfig.agentServer,
        headers: {
            ...(dynamicConfig.agentServer?.headers ?? {}),
        },
    };

    const config: IoAiWeb.WebConfig = { agentServer };

    if (staticConfig.aiWebConfig.mcp) {
        config.mcp = buildMcpConfig(staticConfig.aiWebConfig.mcp);
    }

    if (staticConfig.workingContext) {
        config.context = staticConfig.workingContext;
    }

    return config;
}

/**
 * Mirrors Angular's IoAiWebService.buildMcpConfig(): injects sampling +
 * elicitation handlers. Custom handlers from user config take precedence;
 * otherwise the built-in overlay-driven handlers are used.
 */
function buildMcpConfig(mcp: IoAiWeb.MCPConfig): IoAiWeb.MCPConfig {
    return {
        ...mcp,
        clientsConfig: {
            ...mcp.clientsConfig,
            capabilities: {
                ...mcp.clientsConfig?.capabilities,
                sampling: { handler: selectSampling(mcp) },
                elicitation: { handler: selectElicitation(mcp) },
            },
        },
    };
}

async function listAgents(ioIntelWeb: IoAiWeb.API, defaultAgentName: string | undefined, userId: string, store: IoAssistStoreInstance): Promise<void> {
    const state = store.getState();
    state.setAgentsLoadingState({ type: LOADING_STATES.LOADING });

    try {
        const rawAgents = await ioIntelWeb.agents.list();

        const agents: UIAgent[] = rawAgents.map((a) => ({
            id: a.id,
            name: a.name,
            // `description` is not on IoAiWeb.Agents.Agent's typed surface but some
            // backends surface it via the raw payload — read defensively.
            description: (a as IoAiWeb.Agents.Agent & { description?: string }).description,
            modelId: a.modelId,
            rawAgent: a,
        }));

        state.setAgents(agents);
        state.setAgentsLoadingState({ type: LOADING_STATES.SUCCESS });

        // Select the default agent or first
        const selected = defaultAgentName ? (agents.find((a) => a.name === defaultAgentName) ?? agents[0]) : agents[0];

        if (selected) {
            state.setSelectedAgent(selected);

            // Fetch threads for this agent
            await fetchThreads(ioIntelWeb, selected.rawAgent.id, userId, store);
        }
    } catch (error) {
        store.getState().setAgentsLoadingState({
            type: LOADING_STATES.ERROR,
            message: error instanceof Error ? error.message : "Failed to load agents",
        });
    }
}

async function fetchThreads(ioIntelWeb: IoAiWeb.API, agentId: string, userId: string, store: IoAssistStoreInstance): Promise<void> {
    const state = store.getState();

    state.setThreadLoadingState({ type: LOADING_STATES.LOADING });

    try {
        const rawThreads = await ioIntelWeb.threads.list({
            agentId,
            resourceId: userId,
        });

        const threads: UIThread[] = rawThreads.map((t) => ({
            id: t.id,
            title: t.title || t.id.substring(0, 8),
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
            rawThread: t,
            update: (params: { title: string }) => t.update(params),
            delete: () => t.delete(),
            getMessages: (params: { limit: number }) => t.getMessages(params),
        }));

        state.setThreads(threads);
        state.setThreadLoadingState({ type: LOADING_STATES.SUCCESS });
    } catch (error) {
        store.getState().setThreadLoadingState({
            type: LOADING_STATES.ERROR,
            message: error instanceof Error ? error.message : "Failed to load threads",
        });
    }
}

function loadPrompts(defaultPrompts: IoAssistPromptCategory[], store: IoAssistStoreInstance): void {
    const allPrompts: Prompt[] = defaultPrompts.flatMap((category) =>
        (category.prompts ?? []).map((p: IoAssistPrompt, i: number) => ({
            id: `${category.category ?? "default"}-${i}-${p.name}`,
            name: p.name,
            description: p.prompt,
            category: category.category,
            iconResource: p.iconResource,
        }))
    );

    store.getState().setAllPrompts(allPrompts);
}

async function loadTools(ioIntelWeb: IoAiWeb.API, store: IoAssistStoreInstance): Promise<void> {
    const state = store.getState();
    state.setToolLoadingState({ type: LOADING_STATES.LOADING });

    try {
        const rawTools = await ioIntelWeb.tools.list();

        const tools: UITool[] = rawTools.map((t) => ({
            name: t.name,
            description: t.description ?? "",
            enabled: t.enabled ?? true,
            mcpServerName: t.source?.mcpName ?? undefined,
            state: TOOL_STATES.IDLE,
            rawTool: t,
        }));

        state.setTools(tools);
        state.setToolLoadingState({ type: LOADING_STATES.SUCCESS });
    } catch {
        state.setToolLoadingState({ type: LOADING_STATES.ERROR, message: "Failed to load tools" });
    }
}

async function checkWorkingContext(ioIntelWeb: IoAiWeb.API, store: IoAssistStoreInstance): Promise<void> {
    const state = store.getState();

    try {
        if (!ioIntelWeb.context) {
            state.setIsWorkingContextEnabled(false);
            return;
        }

        state.setIsWorkingContextEnabled(true);
        state.setWorkingContextLoadingState({ type: LOADING_STATES.LOADING });

        const ctx = await ioIntelWeb.context.get();
        state.setWorkingContext(ctx ?? null);
        state.setWorkingContextLoadingState({ type: LOADING_STATES.SUCCESS });

        ioIntelWeb.context.onChanged((newCtx: Record<string, IoIntelWorkingContext.Property>) => {
            store.getState().setWorkingContext(newCtx);
        });
    } catch {
        state.setIsWorkingContextEnabled(false);
    }
}
