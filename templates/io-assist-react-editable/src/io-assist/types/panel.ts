export const PANEL_CONTENT = {
    WORKING_CONTEXT: "working-context",
    PROMPTS: "prompts",
    TOOLS: "tools",
} as const;

export type PanelContent = (typeof PANEL_CONTENT)[keyof typeof PANEL_CONTENT] | null;
