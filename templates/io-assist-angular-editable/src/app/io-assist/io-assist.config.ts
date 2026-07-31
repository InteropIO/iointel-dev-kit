import { InjectionToken, WritableSignal } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { IOConnectNgSettings } from "@interopio/ng";
import { IoIntelWorkingContextFactoryFunction, IoIntelWorkingContext } from "@interopio/working-context";

import { IoAssistPromptCategory } from "./io-assist.types";

export type IoAssistUserConfig = {
    id: string;
    name?: string;
};

/**
 * Runtime config passed as a component input to `<io-assist [config]="...">`.
 * Decoupled from the static provider config so it can be set after login.
 */
export type IoAssistDynamicConfig = {
    user: IoAssistUserConfig;
    agentServer?: {
        /** Request headers sent with every agent call (e.g. per-user auth tokens). */
        headers?: Record<string, string>;
    };
};

export type IoAssistStaticConfig = {
    connectConfig: IOConnectNgSettings;
    aiWebConfig: AIWebConfig;
    defaultAgentName?: string;
    workingContext?: {
        factory: IoIntelWorkingContextFactoryFunction;
        config?: IoIntelWorkingContext.Config;
    };
    defaultPrompts?: IoAssistPromptCategory[];
};

export type AIWebConfig = {
    agentServer: Omit<IoAiWeb.WebConfig["agentServer"], "headers">;
    mcp?: IoAiWeb.WebConfig["mcp"];
};

export const IO_ASSIST_CONFIG = new InjectionToken<IoAssistStaticConfig>("IO_ASSIST_CONFIG");

/**
 * Holds a writable signal that the `IoAssist` component populates from its
 * `config` input. Root-level services (agent, thread effects) inject this to
 * read the current user at call time rather than at construction time.
 */
export const IO_ASSIST_DYNAMIC_CONFIG = new InjectionToken<WritableSignal<IoAssistDynamicConfig>>("IO_ASSIST_DYNAMIC_CONFIG");
