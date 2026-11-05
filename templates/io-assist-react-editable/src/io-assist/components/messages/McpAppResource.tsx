import type { IoAiWeb } from "@interopio/ai-web";
import React, { useRef, useEffect, useState } from "react";

import { IconButton } from "../shared/IconButton";
import { MaximizeIcon, MinimizeIcon } from "../shared/icons";

type Props = {
    appInstance: IoAiWeb.McpApps.AppInstance;
};

/**
 * Mounts the SDK-provided DOM element of an MCP App instance into a container div.
 * The element is owned by the SDK — do not remove it on unmount, just detach.
 */
export const McpAppResource: React.FC<Props> = ({ appInstance }) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const mountedIdRef = useRef<string | null>(null);
    const [isMaximized, setIsMaximized] = useState(appInstance?.isMaximized ?? false);

    const isInline = appInstance?.displayMode === "inline";

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        if (!appInstance?.element) return;
        if (mountedIdRef.current === appInstance.id) return;

        // Clear previous and mount new element
        while (container.firstChild) container.removeChild(container.firstChild);
        container.appendChild(appInstance.element);
        mountedIdRef.current = appInstance.id;
        setIsMaximized(appInstance.isMaximized);
    }, [appInstance]);

    useEffect(() => {
        if (!appInstance) return;

        return appInstance.onDisplayModeChange((mode) => {
            const outer = outerRef.current;

            // Pin the outer wrapper's height to its current (pre-maximize) size before the
            // inner content switches to `position: fixed` (and is removed from flow), so the
            // chat scroll area's total height/scroll position never changes across the toggle.
            if (mode === "fullscreen" && outer) {
                outer.style.height = `${outer.offsetHeight}px`;
            }

            setIsMaximized(mode === "fullscreen");

            if (mode === "inline" && outer) {
                outer.style.height = "";
            }
        });
    }, [appInstance]);

    const onMaximizeClick = (): void => {
        appInstance?.maximize();
    };

    const onMinimizeClick = (): void => {
        appInstance?.minimize();
    };

    return (
        <div ref={outerRef} data-testid="mcp-app-outer">
            <div data-testid="mcp-app-resource" className={isMaximized ? "fixed inset-0 z-1000 bg-app-background" : ""}>
                {isInline && (
                    <div
                        data-testid="mcp-app-header"
                        className={`flex flex-none items-center justify-between gap-2 border-t-2 border-t-app-accent-color-1 border-b border-b-border-default bg-app-background-secondary py-1.5 pr-1.5 pl-3 ${isMaximized ? "absolute top-0 left-0 right-0 z-10" : ""}`}
                    >
                        <span data-testid="mcp-app-title" className="truncate text-xs font-semibold text-text-states-active">
                            {appInstance?.toolName}
                        </span>
                        {isMaximized ? (
                            <IconButton size={16} containerSize={28} testId="mcp-app-minimize-btn" aria-label="Restore" onClick={onMinimizeClick} className="flex-none">
                                <MinimizeIcon />
                            </IconButton>
                        ) : (
                            <IconButton size={16} containerSize={28} testId="mcp-app-maximize-btn" aria-label="Maximize" onClick={onMaximizeClick} className="flex-none">
                                <MaximizeIcon />
                            </IconButton>
                        )}
                    </div>
                )}
                <div
                    ref={containerRef}
                    data-testid="mcp-app-container"
                    className={`w-full min-h-48 ${isMaximized ? "absolute inset-0 overflow-auto [&>div]:h-full! [&_iframe]:h-full!" : ""}`}
                />
            </div>
        </div>
    );
};



