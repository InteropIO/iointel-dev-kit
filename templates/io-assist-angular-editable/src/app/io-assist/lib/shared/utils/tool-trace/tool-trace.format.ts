export const toRawJson = (value: unknown): string => {
    if (value === undefined) return "";

    if (typeof value === "string") return value;

    const seen = new WeakSet<object>();

    try {
        return JSON.stringify(
            value,
            (_key, nested: unknown) => {
                if (typeof nested === "bigint") return nested.toString();

                if (typeof nested === "object" && nested !== null) {
                    if (seen.has(nested)) return "[circular]";
                    seen.add(nested);
                }

                return nested;
            },
            2
        );
    } catch {
        return String(value);
    }
};

export const formatDuration = (durationMs: number | undefined): string | undefined => {
    if (durationMs === undefined || !Number.isFinite(durationMs)) return undefined;

    const seconds = durationMs / 1000;

    if (seconds < 60) return `${seconds.toFixed(1)}s`;

    const minutes = Math.floor(seconds / 60);

    return `${minutes}m ${Math.round(seconds % 60)}s`;
};
