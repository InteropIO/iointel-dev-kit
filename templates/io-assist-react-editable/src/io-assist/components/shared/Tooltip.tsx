import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

/**
 * Controls when the tooltip is shown.
 * - `hover` : shown on mouse hover/focus only (default).
 * - `event` : shown only programmatically via `forceVisible` — hover is suppressed.
 * - `both`  : shown on hover and/or via `forceVisible`.
 */
export type TooltipDisplayMode = "hover" | "event" | "both";

type Props = {
    content: React.ReactNode;
    position?: TooltipPosition;
    offset?: number;
    displayMode?: TooltipDisplayMode;
    /** Programmatically show the tooltip when displayMode is 'event' or 'both'. */
    forceVisible?: boolean;
    /** When true the tooltip never shows (e.g. content conditionally projected). */
    disabled?: boolean;
    children: React.ReactNode;
};

const VIEWPORT_PADDING = 8;
const ARROW_MARGIN = 10; // keep arrow at least 10px from each tooltip edge

// Reusable hover/event tooltip — mirrors ng AppTooltipComponent. The bubble
// mounts invisible, we measure + clamp to the viewport, then fade it in once
// positioned. An arrow tracks the trigger centre even after the box is clamped.
export const Tooltip: React.FC<Props> = ({ content, position = "top", offset = 14, displayMode = "hover", forceVisible = false, disabled = false, children }) => {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const bubbleRef = useRef<HTMLDivElement>(null);
    const [hoverVisible, setHoverVisible] = useState(false);
    const [isPositioned, setIsPositioned] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const [arrowOffset, setArrowOffset] = useState(0);

    const isHoverEnabled = displayMode !== "event";
    const visible = !disabled && (displayMode === "event" ? forceVisible : displayMode === "both" ? hoverVisible || forceVisible : hoverVisible);

    const updatePosition = useCallback(() => {
        const triggerEl = triggerRef.current;
        const bubbleEl = bubbleRef.current;
        if (!triggerEl || !bubbleEl) return;

        const t = triggerEl.getBoundingClientRect();
        const b = bubbleEl.getBoundingClientRect();

        let x = 0;
        let y = 0;

        if (position === "top") {
            x = t.left + t.width / 2 - b.width / 2;
            y = t.top - b.height - offset;
            x = Math.max(VIEWPORT_PADDING, Math.min(x, window.innerWidth - b.width - VIEWPORT_PADDING));
        } else if (position === "bottom") {
            x = t.left + t.width / 2 - b.width / 2;
            y = t.bottom + offset;
            x = Math.max(VIEWPORT_PADDING, Math.min(x, window.innerWidth - b.width - VIEWPORT_PADDING));
        } else if (position === "left") {
            x = t.left - b.width - offset;
            y = t.top + t.height / 2 - b.height / 2;
            y = Math.max(VIEWPORT_PADDING, Math.min(y, window.innerHeight - b.height - VIEWPORT_PADDING));
        } else if (position === "right") {
            x = t.right + offset;
            y = t.top + t.height / 2 - b.height / 2;
            y = Math.max(VIEWPORT_PADDING, Math.min(y, window.innerHeight - b.height - VIEWPORT_PADDING));
        }

        // Keep the arrow pointing at the trigger centre after clamping.
        const isHorizontal = position === "top" || position === "bottom";
        const rawOffset = isHorizontal ? t.left + t.width / 2 - x : t.top + t.height / 2 - y;
        const maxOffset = isHorizontal ? b.width : b.height;
        setArrowOffset(Math.max(ARROW_MARGIN, Math.min(rawOffset, maxOffset - ARROW_MARGIN)));

        setCoords({ x, y });
    }, [position, offset]);

    useLayoutEffect(() => {
        if (!visible) return;
        updatePosition();
        setIsPositioned(true);
    }, [visible, updatePosition]);

    useEffect(() => {
        if (!visible) return;
        const onChange = () => updatePosition();
        window.addEventListener("scroll", onChange, true);
        window.addEventListener("resize", onChange);
        return () => {
            window.removeEventListener("scroll", onChange, true);
            window.removeEventListener("resize", onChange);
        };
    }, [visible, updatePosition]);

    const show = () => {
        if (!isHoverEnabled || disabled) return;
        setIsPositioned(false);
        setHoverVisible(true);
    };
    const hide = () => {
        if (!isHoverEnabled) return;
        setHoverVisible(false);
    };

    const arrowStyle: React.CSSProperties = position === "top" || position === "bottom" ? { left: `${arrowOffset}px` } : { top: `${arrowOffset}px` };

    return (
        <span ref={triggerRef} className="inline-block" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
            {children}
            {visible && (
                <div
                    ref={bubbleRef}
                    className={["fixed z-[999999] pointer-events-none transition-opacity duration-[120ms] max-w-[320px]", isPositioned ? "opacity-100" : "opacity-0"].join(" ")}
                    style={{ left: `${coords.x}px`, top: `${coords.y}px` }}
                >
                    <div className="relative flex flex-col items-start gap-1 px-[4px] py-[3px] rounded-[4px] border border-tooltip-border bg-tooltip-background text-tooltip-text text-[9px] tracking-[0.09px] leading-[11px]">
                        {content}
                        <div className={`app-tooltip__arrow app-tooltip__arrow--${position}`} style={arrowStyle} />
                    </div>
                </div>
            )}
        </span>
    );
};
