import type { PrismTheme } from "prism-react-renderer";

/**
 * Code panel syntax theme — colors reference the `--app-code-panel-*` CSS custom
 * properties (defined in styles/defaults.css, dark by default / light under `.light`),
 * so a single theme object works in both app themes. Mirrors ng's `app-code-panel`
 * Prism token-class mapping.
 */
export const codePanelPrismTheme: PrismTheme = {
    plain: {
        color: "var(--app-code-panel-text)",
        backgroundColor: "transparent",
    },
    styles: [
        {
            types: ["comment", "prolog", "doctype", "cdata"],
            style: { color: "var(--app-code-panel-comment)", fontStyle: "italic" },
        },
        {
            types: ["keyword", "boolean", "null", "important", "atrule"],
            style: { color: "var(--app-code-panel-keyword)" },
        },
        {
            types: ["function", "class-name"],
            style: { color: "var(--app-code-panel-function)" },
        },
        {
            types: ["property", "property-access", "parameter", "attr-name"],
            style: { color: "var(--app-code-panel-property)" },
        },
        {
            types: ["string", "char", "builtin", "url", "regex", "attr-value"],
            style: { color: "var(--app-code-panel-string)" },
        },
        {
            types: ["number"],
            style: { color: "var(--app-code-panel-number)" },
        },
        {
            types: ["operator", "punctuation", "tag", "entity"],
            style: { color: "var(--app-code-panel-punctuation)" },
        },
    ],
};
