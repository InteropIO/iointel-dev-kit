export const textToJSONMarkdown = (content: unknown): string => {
    return "```json\n" + JSON.stringify(content, null, 2) + "\n```";
};
