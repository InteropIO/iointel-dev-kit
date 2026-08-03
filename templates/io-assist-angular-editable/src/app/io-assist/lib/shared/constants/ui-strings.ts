/**
 * Shared UI strings for the whole application
 * Strings are grouped by component, feature or defaults
 */
export const UI_STRINGS = {
    INPUT_COMPONENT: {
        DEFAULT_PLACEHOLDER: "Enter text here",
        INPUT_PLACEHOLDER: "Type your message...",
    },
    PANEL_COMPONENT: {
        DEFAULT_TITLE: "Panel",
        CLOSE_BUTTON: "Close",
    },
    MESSAGE_FOOTER_COMPONENT: {
        RELOAD_DISABLED_TOOLTIP: "Response is pending...",
    },
    HEADER_COMPONENT: {
        HOME_TOOLTIP: "Start new chat",
        CONTEXT_TOOLTIP: "The working context provides information to assist the agent in generating accurate responses.",
    },
    WORKING_CONTEXT_PANEL_COMPONENT: {
        TITLE: "Working Context",
        VIEW_WORKING_CONTEXT_BUTTON: "View Context",
        LOADING_CONTEXT: "Loading working context...",
        CALLOUT_TEXT: "The working context provides additional information to assist the agent in generating accurate responses.",
    },
    CHAT_COMPONENT: {
        LOGOUT: "Logout",
    },
    THREAD_HISTORY_COMPONENT: {
        NO_THREADS: "No available message threads.",
        LOADING_THREADS: "Loading threads...",
        DIVIDERS: {
            JUST_NOW: "Just now",
            FIVE_MINS_AGO: "5 mins ago",
            THIRTY_MINS_AGO: "30 mins ago",
            ONE_HOUR_AGO: "1 hour ago",
            TWO_HOURS_AGO: "2 hours ago",
            SIX_HOURS_AGO: "6 hours ago",
            TWELVE_HOURS_AGO: "12 hours ago",
            TODAY: "Today",
            YESTERDAY: "Yesterday",
            TWO_DAYS_AGO: "2 days ago",
            LAST_WEEK: "Last Week",
            TWO_WEEKS_AGO: "2 weeks ago",
            ONE_MONTH_AGO: "1 month ago",
            THREE_MONTHS_AGO: "3 months ago",
            SIX_MONTHS_AGO: "6 months ago",
            MORE_THAN_YEAR_AGO: "more than 1 year ago",
        },
    },
    PROMPT_LIST_COMPONENT: {
        AVAILABLE_PROMPTS: "Available Prompts",
        FAVORITE_PROMPTS: "Favorite Prompts",
        NO_PROMPTS: "No prompts available.",
        NO_PROMPTS_CONFIGURED: "No prompts are available. Prompts should be provided as a configuration.",
        NO_PROMPTS_SEE_MORE: "See more",
        LOADING_PROMPTS: "Loading prompts...",
        NO_FAVORITE_PROMPTS: "No favorite prompts available.",
        INPUT_TOOLTIP: "Search prompts...",
    },
    TOOL_LIST_COMPONENT: {
        AVAILABLE_TOOLS: "Available Tools",
        NO_FILTERED_TOOLS: "No tools matching your search.",
        NO_TOOLS: "There are currently no tools available.",
        NO_TOOLS_SEE_MORE: "See more",
        LOADING_TOOLS: "Loading tools...",
        INPUT_TOOLTIP: "Search tools...",
    },
    TOOL_LIST_ITEM_COMPONENT: {
        ENABLE_BUTTON: "Enable",
        DISABLE_BUTTON: "Disable",
    },
    TOOL_INFO: {
        DEFAULT_TOOL_DESCRIPTION: "No description available.",
    },
    TOOL_MESSAGE: {
        TOOL_EXECUTION_SUCCESS: "Tool executed successfully.",
        TOOL_EXECUTION_PENDING: "Tool execution in progress...",
    },
    TOOL_TRACE_MESSAGE_COMPONENT: {
        EXPAND_BUTTON_TEXT: "Show Tool Trace Details",
        COLLAPSE_BUTTON_TEXT: "Hide Tool Trace Details",
        CLOSE_BUTTON_TEXT: "Close",
    },
    GENERAL: {
        EDIT: "Edit",
        DELETE: "Delete",
        SAVE: "Save",
        CANCEL: "Cancel",
        CONFIRM: "Confirm",
        SUBMIT: "Submit",
        SEARCH: "Search",
        LOADING: "Loading",
        COPY: "Copy",
        COPIED: "Copied!",
        RELOAD: "Reload",
        NO_SEARCH_RESULTS: "No results found",
        WELCOME_MESSAGE(user?: string): string {
            return user ? `Welcome, ${user}! How can I assist you today?` : "Welcome! How can I assist you today?";
        },
        CANNOT_CONNECT_TO_IO: "Cannot connect to IO.",
        AI_CONTENT_INFO: "AI-generated content may be incorrect",
        INITIALIZING_SERVICES: "Initializing services, please wait...",
        REFRESH: "Refresh",
        IO_INTEL_INIT_ERROR: "Error initializing IO Intel Web API. Please check your configuration and refresh the page to try again.",
        DOCUMENTATION_LINK(url?: string): string {
            return `For more information, please refer to the documentation: ${url && url.length > 0 ? url : "https://docs-ai.interop.io/"}`;
        },
    },
    SAMPLING_MODAL: {
        TITLE: "io.Assist",
        HEADING: "Permission to Proceed",
        TEXT: `I can dive deeper to give a clearer answer, but I'll need your permission first. Continue?`,
    },
    ELICITATION_MODAL: {
        TITLE: "io.Assist",
        HEADING: "Permission to Proceed",
        FALLBACK_TEXT: "I can dive deeper to give a clearer answer, but I’ll need your permission first. Continue?",
    },
    MCP_APP_REPLACE_MODAL: {
        TITLE: "MCP App Already Open",
        HEADING: "Replace Existing Instance?",
        TEXT: (toolName: string) => `An instance of "${toolName}" is already open in the workspace. Replace it with the new instance, or open it alongside as a new instance?`,
        REPLACE_BUTTON: "Replace",
        NEW_INSTANCE_BUTTON: "New Instance",
    },
};
