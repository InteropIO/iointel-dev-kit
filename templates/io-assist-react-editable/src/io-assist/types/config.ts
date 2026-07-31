import type { IoAiWeb } from "@interopio/ai-web";
import type { IOConnectBrowser, IOConnectBrowserFactoryFunction } from "@interopio/browser";
import type { IOConnectDesktop } from "@interopio/desktop";

import type { IoAssistPromptCategory } from "./prompt";

export type IoAssistUserConfig = {
    id: string;
    name?: string;
};

/**
 * Runtime config passed as a prop to `<IoAssist config={...}>`.
 * Populated after login with user identity and per-request auth headers.
 */
export type IoAssistDynamicConfig = {
    user: IoAssistUserConfig;
    agentServer?: {
        /** Request headers sent with every agent call (e.g., per-user auth tokens). */
        headers?: Record<string, string>;
    };
};

export type IoConnectBrowserFactoryEntry = {
    factory: IOConnectBrowserFactoryFunction;
    config?: IOConnectBrowser.Config;
};

export type IoConnectDesktopFactoryEntry = {
    factory: (config?: IOConnectDesktop.Config) => Promise<IOConnectDesktop.API>;
    config?: IOConnectDesktop.Config;
};

export type IoAssistStaticConfig = {
    connectConfig: {
        browser?: IoConnectBrowserFactoryEntry;
        desktop?: IoConnectDesktopFactoryEntry;
    };
    aiWebConfig: {
        agentServer: IoAiWeb.AgentServerConfig;
        mcp?: IoAiWeb.MCPConfig;
    };
    defaultAgentName?: string;
    workingContext?: IoAiWeb.WorkingContextConfig;
    defaultPrompts?: IoAssistPromptCategory[];
};
