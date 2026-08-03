import { IoAiWeb } from "@interopio/ai-web";
import { z, ZodType } from "zod";

import { AIWebConfig, IoAssistStaticConfig, IoAssistDynamicConfig } from "./io-assist.config";
import { IoAssistPrompt, IoAssistPromptCategory } from "./io-assist.types";

const MCPRemoteServerConfigSchema = z.object({
    streamableHttp: z.object({
        url: z.string().url(),
        name: z.string(),
        options: z.any().optional(), // pass-through options for StreamableHTTPClientTransport, maybe do full validation later
    }),
}) satisfies ZodType<IoAiWeb.MCPRemoteServerConfig>;

const MCPClientConfigSchema = z.object({
    enforceStrictCapabilities: z.boolean().optional(),
    debouncedNotificationMethods: z.array(z.string()).optional(),
    capabilities: z.object({
        sampling: z
            .object({
                handler: z.function().args(z.string(), z.any()).returns(z.any()).describe("A function that handles sampling requests from the MCP server."),
            })
            .optional()
            .describe("Configuration for sampling capabilities."),
        elicitation: z
            .object({
                handler: z.function().args(z.string(), z.any()).returns(z.any()).describe("A function that handles elicitation requests from the MCP server."),
            })
            .optional()
            .describe("Configuration for elicitation capabilities."),
        extensions: z.record(z.any()).optional(),
        experimental: z.record(z.any()).optional(),
    }),
}) satisfies ZodType<IoAiWeb.MCPClientConfig>;

const MCPConfigSchema = z.object({
    clientsConfig: MCPClientConfigSchema.optional(),
    ioIntel: z
        .object({
            remote: MCPRemoteServerConfigSchema.optional(),
            web: z
                .object({
                    enabled: z.boolean().optional(),
                    hasPriority: z.boolean().optional(),
                })
                .optional(),
        })
        .optional(),
    remoteServers: z.array(MCPRemoteServerConfigSchema).optional(),
    mcpApps: z
        .object({
            sandboxProxyUrl: z.string(),
            displayMode: z.enum(["inline", "workspace"]).optional(),
        })
        .optional(),
});

const AgentServerConfigSchema = z.object({
    baseUrl: z.string().url(),
    retries: z.number().int().min(0).optional(),
    backoffMs: z.number().int().min(0).optional(),
    maxBackoffMs: z.number().int().min(0).optional(),
    abortSignal: z.any().optional(),
    credentials: z.enum(["omit", "same-origin", "include"]).optional(),
});

/**
 * Schema for validating IOConnectNg settings objects.
 */
const IOConnectNgSettingsSchema = z.record(z.string(), z.any());

const AIWebConfigSchema = z.object({
    agentServer: AgentServerConfigSchema,
    mcp: MCPConfigSchema.optional(),
}) as ZodType<AIWebConfig>;

/**
 * Schema for validating working context configuration objects.
 */
const WorkingContextConfigSchema = z.object({
    factory: z.function().args(z.any(), z.any()).returns(z.promise(z.any())).describe("A factory function to create the working context API instance."),
    config: z.any().describe("Configuration object for the working context factory."),
}) satisfies ZodType<IoAiWeb.WorkingContextConfig>;

/**
 * Schema for validating individual IoAssist prompt objects.
 */
const IconResourceSchema = z.object({
    type: z.enum(["svg", "url", "data-url"]),
    data: z.string().min(1),
});

// Strip invalid iconResource rather than rejecting the whole config parse.
// The app's prompt.service.ts independently validates iconResource at runtime.
const IoAssistPromptSchema = z.object({
    name: z.string().min(1),
    prompt: z.string().min(1),
    iconResource: IconResourceSchema.optional().catch(undefined),
}) as unknown as ZodType<IoAssistPrompt>;

const IoAssistPromptCategorySchema = z.object({
    category: z.string().optional(),
    prompts: z.array(IoAssistPromptSchema),
}) satisfies ZodType<IoAssistPromptCategory>;

/**
 * Schema for validating user configuration.
 */
const IoAssistUserConfigSchema = z.object({
    id: z.string().min(1, "User id is required and must be a non-empty string."),
    name: z.string().optional(),
});

/**
 * Main schema for validating IoAssist configuration objects.
 */
export const IoAssistStaticConfigSchema = z.object({
    connectConfig: IOConnectNgSettingsSchema,
    aiWebConfig: AIWebConfigSchema,
    defaultAgentName: z.string().optional(),
    workingContext: WorkingContextConfigSchema.optional(),
    defaultPrompts: z.array(IoAssistPromptCategorySchema).optional(),
}) satisfies ZodType<IoAssistStaticConfig>;

/**
 * Schema for validating the dynamic config passed as a component input.
 */
export const IoAssistDynamicConfigSchema = z.object({
    user: IoAssistUserConfigSchema,
    agentServer: z
        .object({
            headers: z.record(z.string()).optional(),
        })
        .optional(),
}) satisfies ZodType<IoAssistDynamicConfig>;
