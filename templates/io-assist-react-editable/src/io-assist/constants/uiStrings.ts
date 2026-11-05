export const UI_STRINGS = {
    GENERAL: {
        WELCOME_MESSAGE: (user?: string) => (user ? `Welcome, ${user}! How can I assist you today?` : "Welcome! How can I assist you today?"),
        AI_CONTENT_INFO: "AI-generated content may be incorrect",
        INITIALIZING_SERVICES: "Initializing services, please wait...",
        CANNOT_CONNECT_TO_IO: "Cannot connect to IO.",
        IO_INTEL_INIT_ERROR: "Error initializing IO Intel Web API. Please check your configuration and refresh the page to try again.",
        DOCUMENTATION_LINK: (url?: string) => `For more information, please refer to the documentation: ${url && url.length > 0 ? url : "https://docs-ai.interop.io/"}`,
        MISMATCHED_CUSTOM_HANDLERS_ERROR: (providedHandler: "sampling" | "elicitation") => {
            const missingHandler = providedHandler === "sampling" ? "elicitation" : "sampling";

            return (
                `IO Assist configuration error: a custom ${providedHandler} handler was provided without a matching custom ${missingHandler} handler. ` +
                `Custom permission handlers must be provided for BOTH sampling and elicitation together, or for neither (to use the built-in io.Assist handlers). ` +
                `Please add a custom ${missingHandler} handler, or remove the custom ${providedHandler} handler.`
            );
        },
        REFRESH: "Refresh",
        EDIT: "Edit",
        DELETE: "Delete",
        SAVE: "Save",
        CANCEL: "Cancel",
        CONFIRM: "Confirm",
        SUBMIT: "Submit",
        SEARCH: "Search",
        LOADING: "Loading",
        COPY: "Copy",
        COPIED: "Copied",
        RELOAD: "Reload",
        NO_SEARCH_RESULTS: "No results found",
        SCROLL_TO_BOTTOM: "Scroll to bottom",
    },
    MESSAGE_FOOTER_COMPONENT: {
        RELOAD_DISABLED_TOOLTIP: "Response is pending...",
    },
    HEADER_COMPONENT: {
        HOME_TOOLTIP: "Start new chat",
        CONTEXT_TOOLTIP: "The working context provides information to assist the agent in generating accurate responses.",
    },
    INPUT_COMPONENT: {
        DEFAULT_PLACEHOLDER: "Enter text here",
        INPUT_PLACEHOLDER: "Type your message...",
        AI_DISCLAIMER: "Ai-generated content may be incorrect",
    },
    PANEL_COMPONENT: {
        DEFAULT_TITLE: "Panel",
        CLOSE_BUTTON: "Close",
    },
    WORKING_CONTEXT_PANEL_COMPONENT: {
        TITLE: "Working Context",
        VIEW_WORKING_CONTEXT_BUTTON: "View Context",
        LOADING_CONTEXT: "Loading working context...",
        SUBTITLE: "Context the assistant can use from io.Connect",
        CALLOUT_TEXT: "The working context provides additional information to assist the agent in generating accurate responses.",
    },
    CHAT_COMPONENT: {
        LOGOUT: "Logout",
    },
    THREAD_HISTORY_COMPONENT: {
        NO_THREADS: "No available message threads.",
        LOADING_THREADS: "Loading threads...",
        NEW_CONVERSATION: "New Conversation",
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
        LOADING_PROMPTS: "Loading prompts...",
        NO_FAVORITE_PROMPTS: "No favorite prompts available.",
        NO_PROMPTS_SEE_MORE: "See more",
        INPUT_TOOLTIP: "Search prompts...",
    },
    TOOL_LIST_COMPONENT: {
        AVAILABLE_TOOLS: "Available Tools",
        NO_FILTERED_TOOLS: "No tools matching your search.",
        NO_TOOLS: "There are currently no tools available.",
        NO_TOOLS_SEE_MORE: "See more",
        LOADING_TOOLS: "Loading tools...",
        INPUT_TOOLTIP: "Search tools...",
        SYSTEM_TOOLS_GROUP: "System",
        ENABLE_BUTTON: "Enable",
        DISABLE_BUTTON: "Disable",
    },
    TOOL_LIST_ITEM_COMPONENT: {
        SHOW_DETAILS: (toolName: string) => `Show details for ${toolName}`,
    },
    TOOL_DETAILS: {
        DEFAULT_TOOL_DESCRIPTION: "No description available.",
        SHOW_MORE: "Show more",
        SHOW_LESS: "Show less",
    },
    TOOL_MESSAGE: {
        RUNNING: "Running...",
        STATUS_LABELS: {
            running: "Running",
            error: "Failed",
        },
        TABS_LABEL: "Step details",
        TAB_INPUT: "Input",
        TAB_OUTPUT: "Output",
        TAB_CODE: "Code",
        EXPLANATION_LABEL: "Explanation",
        NO_OUTPUT: "Returned nothing",
        NO_CODE: "No code available.",
        LANGUAGE_JSON: "JSON",
        LANGUAGE_JAVASCRIPT: "JavaScript",
        LANGUAGE_PLAIN_TEXT: "Plain text",
    },
    TOOL_TRACE_MESSAGE: {
        EXPAND_BUTTON_TEXT: "Show Tool Trace Details",
        COLLAPSE_BUTTON_TEXT: "Hide Tool Trace Details",
    },

    // ── Aliases used by panel + layout components ──────────────────────────

    THREAD_HISTORY: {
        NEW_CONVERSATION: "New Conversation",
        NO_CONVERSATIONS: "No conversations yet.",
    },
    WORKING_CONTEXT_PANEL: {
        TITLE: "Working Context",
        DESCRIPTION: "The working context provides additional information to assist the agent in generating accurate responses.",
        EMPTY: "No working context available.",
    },
    PROMPT_LIST_PANEL: {
        TITLE: "Prompts",
        SEARCH_PLACEHOLDER: "Search prompts...",
        EMPTY: "No prompts available.",
    },
    TOOL_LIST_PANEL: {
        TITLE: "Tools",
        SEARCH_PLACEHOLDER: "Search tools...",
        EMPTY: "There are currently no tools available.",
        NO_SEARCH_MATCH: "No tools matching your search.",
        LOADING: "Loading tools...",
        SERVER_LABEL: "Server:",
    },
    WELCOME_SCREEN: {
        TITLE: "Welcome {name}, how can I help?",
        SUBTITLE: "Ask me anything or pick a quick prompt below.",
        FAVORITE_PROMPTS_LABEL: "Favorite Prompts",
    },
    LOADING_STATE: {
        LOADING: "Initializing services, please wait...",
        ERROR: "Error initializing IO Intel Web API. Please check your configuration and refresh the page to try again.",
        RETRY: "Refresh",
    },
    PERMISSION_REQUEST_CARD_COMPONENT: {
        PROCEED_QUESTION: "Do you want to proceed?",
    },
    SAMPLING_PERMISSION_CARD: {
        TEXT: `I can dive deeper to give a clearer answer, but I'll need your permission first. Continue?`,
    },
    ELICITATION_PERMISSION_CARD: {
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
