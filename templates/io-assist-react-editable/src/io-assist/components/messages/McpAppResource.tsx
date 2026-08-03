import type { IoAiWeb } from "@interopio/ai-web";
import React, { useRef, useEffect } from "react";

type Props = {
    appInstance: IoAiWeb.McpApps.AppInstance;
};

/**
 * Mounts the SDK-provided DOM element of an MCP App instance into a container div.
 * The element is owned by the SDK — do not remove it on unmount, just detach.
 */
export const McpAppResource: React.FC<Props> = ({ appInstance }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mountedIdRef = useRef<string | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        if (!appInstance?.element) return;
        if (mountedIdRef.current === appInstance.id) return;

        // Clear previous and mount new element
        while (container.firstChild) container.removeChild(container.firstChild);
        container.appendChild(appInstance.element);
        mountedIdRef.current = appInstance.id;
    }, [appInstance]);

    return (
        <div data-testid="mcp-app-resource" className="rounded-xl border border-border-default bg-app-background-secondary overflow-hidden">
            <div ref={containerRef} data-testid="mcp-app-iframe" className="w-full min-h-48" />
        </div>
    );
};
