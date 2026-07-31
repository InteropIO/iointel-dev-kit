import type { PrismTheme } from "prism-react-renderer";

/**
 * Code syntax theme — flat palette matching the io-assist-ng Figma design.
 * The code block background is provided by the surrounding container, so the
 * theme background is transparent.
 */
export const prismTwilight: PrismTheme = {
    plain: {
        color: "#caccce",
        backgroundColor: "transparent",
    },
    styles: [
        {
            types: ["comment", "prolog", "doctype", "cdata"],
            style: { color: "#6a6d72", fontStyle: "italic" },
        },
        // Keywords: import, export, from, const, function, class, return, if...
        {
            types: ["keyword", "module", "important", "atrule"],
            style: { color: "#fb4bba" },
        },
        // Identifiers: function names, class names, variables, props
        {
            types: ["function", "class-name", "variable", "attr-name", "property"],
            style: { color: "#4b92fb" },
        },
        // Strings and types
        {
            types: ["string", "char", "builtin", "url", "regex", "attr-value", "inserted"],
            style: { color: "#e39292" },
        },
        // Numbers, booleans
        {
            types: ["number", "boolean"],
            style: { color: "#4b92fb" },
        },
        // Operators and punctuation — default gray
        {
            types: ["operator", "punctuation", "tag", "entity"],
            style: { color: "#caccce" },
        },
        {
            types: ["important", "bold"],
            style: { fontWeight: "bold" },
        },
        {
            types: ["italic"],
            style: { fontStyle: "italic" },
        },
    ],
};
