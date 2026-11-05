// SDK adapter: initialises IoAiWeb after io.Connect is ready, then runs the
// post-init data loaders (agents, threads, prompts, tools, working context).
// This module mutates the store via `store.getState().setX()` — selectors are
// reserved for render-coupled reads in the React tree.

import type { IoAiWeb } from "@interopio/ai-web";
import type { IoIntelWorkingContext } from "@interopio/working-context";

import type { IoAssistStoreInstance } from "../stores";
import { LOADING_STATES } from "../types";
import type { IoAssistDynamicConfig, IoAssistPrompt, IoAssistPromptCategory, IoAssistStaticConfig, Prompt, UIAgent } from "../types";
import { selectElicitation } from "./elicitation";
import { wireMcpAppEvents } from "./mcpAppEvents";
import { refreshThreads } from "./refreshThreads";
import { refreshTools } from "./refreshTools";
import { selectSampling } from "./sampling";
import { UI_STRINGS } from "../constants/uiStrings";
import { getCustomMcpCapabilityHandlerPresence } from "../utils/customMcpCapabilityHandlers";
import { logger } from "../utils/logger";

const LOGGER_NAME = "InitIoAiWeb";
const log = logger.get(LOGGER_NAME);

export async function initIoAiWeb(staticConfig: IoAssistStaticConfig, dynamicConfig: IoAssistDynamicConfig, store: IoAssistStoreInstance): Promise<void> {
    try {
        validateCustomMcpCapabilityHandlerConfig(staticConfig.aiWebConfig.mcp);

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
            refreshTools(store),
            checkWorkingContext(ioIntelWeb, store),
        ]);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to initialise IO Intel Web API";

        store.getState().setAppLoadingState({ type: LOADING_STATES.ERROR, message });
        log.error("IoAiWeb initialisation failed.", error instanceof Error ? error : new Error(String(error)));
    }
}

function validateCustomMcpCapabilityHandlerConfig(mcp: IoAiWeb.MCPConfig | undefined): void {
    const { hasCustomSamplingHandler, hasCustomElicitationHandler } = getCustomMcpCapabilityHandlerPresence(mcp);

    if (hasCustomSamplingHandler === hasCustomElicitationHandler) return;

    const providedHandler: "sampling" | "elicitation" = hasCustomSamplingHandler ? "sampling" : "elicitation";
    const message = UI_STRINGS.GENERAL.MISMATCHED_CUSTOM_HANDLERS_ERROR(providedHandler);

    log.error(message);

    throw new Error(message);
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

    if (staticConfig.aiWebConfig.codeMode) {
        config.codeMode = staticConfig.aiWebConfig.codeMode;
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
            await refreshThreads(ioIntelWeb, selected.rawAgent.id, userId, store, true);
        }
    } catch (error) {
        store.getState().setAgentsLoadingState({
            type: LOADING_STATES.ERROR,
            message: error instanceof Error ? error.message : "Failed to load agents",
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
