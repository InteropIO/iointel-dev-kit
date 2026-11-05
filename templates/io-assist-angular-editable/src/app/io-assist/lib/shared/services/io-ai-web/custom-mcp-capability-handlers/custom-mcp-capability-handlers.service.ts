import { Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";

export type CustomMcpCapabilityHandlerPresence = {
    hasCustomSamplingHandler: boolean;
    hasCustomElicitationHandler: boolean;
};

@Injectable({
    providedIn: "root",
})
export class CustomMcpCapabilityHandlersService {
    public getCustomMcpCapabilityHandlerPresence(mcp: IoAiWeb.WebConfig["mcp"] | undefined): CustomMcpCapabilityHandlerPresence {
        return {
            hasCustomSamplingHandler: !!mcp?.clientsConfig?.capabilities?.sampling?.handler,
            hasCustomElicitationHandler: !!mcp?.clientsConfig?.capabilities?.elicitation?.handler,
        };
    }

    public hasBothCustomMcpCapabilityHandlers(mcp: IoAiWeb.WebConfig["mcp"] | undefined): boolean {
        const { hasCustomSamplingHandler, hasCustomElicitationHandler } = this.getCustomMcpCapabilityHandlerPresence(mcp);

        return hasCustomSamplingHandler && hasCustomElicitationHandler;
    }
}
