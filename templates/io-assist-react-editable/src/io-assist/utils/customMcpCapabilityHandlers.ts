import type { IoAiWeb } from "@interopio/ai-web";

export type CustomMcpCapabilityHandlerPresence = {
    hasCustomSamplingHandler: boolean;
    hasCustomElicitationHandler: boolean;
};

export function getCustomMcpCapabilityHandlerPresence(mcp: IoAiWeb.MCPConfig | undefined): CustomMcpCapabilityHandlerPresence {
    return {
        hasCustomSamplingHandler: !!mcp?.clientsConfig?.capabilities?.sampling?.handler,
        hasCustomElicitationHandler: !!mcp?.clientsConfig?.capabilities?.elicitation?.handler,
    };
}

export function hasBothCustomMcpCapabilityHandlers(mcp: IoAiWeb.MCPConfig | undefined): boolean {
    const { hasCustomSamplingHandler, hasCustomElicitationHandler } = getCustomMcpCapabilityHandlerPresence(mcp);

    return hasCustomSamplingHandler && hasCustomElicitationHandler;
}
