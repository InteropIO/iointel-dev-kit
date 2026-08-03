import React, { useRef, useEffect, useCallback, useState } from "react";

import { Icon } from "../shared/Icon";
import { ChevronDownIcon } from "../shared/icons";

type Props = {
    children: React.ReactNode;
    className?: string;
    shouldExpandSpacer?: boolean;
    isForceScrollToBottomEnabled?: boolean;
    snapToTopTrigger?: number;
    observeRef?: React.RefObject<HTMLElement | null>;
};

const SCROLL_THRESHOLD = 20;
// Spacer height when expanded is `clientHeight - EXPANDED_SPACER_OFFSET`. ng uses 118 here
// because the message list's last child carries 32px bottom padding ([&>*:last-child]:pb-8),
// for a total bottom offset of 150. Keep these in lockstep with ng's scroll-area.
const EXPANDED_SPACER_OFFSET = 118;
const SCROLL_BUTTON_SHOW_DELAY = 250;

export const ScrollArea: React.FC<Props> = ({ children, className = "", shouldExpandSpacer = false, isForceScrollToBottomEnabled = false, snapToTopTrigger, observeRef }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const spacerRef = useRef<HTMLDivElement>(null);
    const showTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const propsRef = useRef({ shouldExpandSpacer, isForceScrollToBottomEnabled });
    propsRef.current = { shouldExpandSpacer, isForceScrollToBottomEnabled };

    const isCloseToBottom = useCallback((): boolean => {
        const el = containerRef.current;
        if (!el) return true;
        return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD;
    }, []);

    const scrollToBottom = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, []);

    const handleSpacerBehavior = useCallback(() => {
        const container = containerRef.current;
        const spacer = spacerRef.current;
        if (!container || !spacer) return;

        if (propsRef.current.shouldExpandSpacer) {
            spacer.style.minHeight = `${Math.max(0, container.clientHeight - EXPANDED_SPACER_OFFSET)}px`;
            // Match ng: after expanding the spacer, snap to the bottom so the just-sent user
            // message rests near the top with the empty space below it.
            scrollToBottom();
            return;
        }

        const overflow = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (overflow <= SCROLL_THRESHOLD) return;
        const newHeight = Math.max(spacer.offsetHeight - overflow, 0);
        spacer.style.minHeight = `${newHeight}px`;
    }, [scrollToBottom]);

    const snapToTop = useCallback(() => {
        const container = containerRef.current;
        const spacer = spacerRef.current;
        if (!container || !spacer) return;
        spacer.style.minHeight = `${Math.max(0, container.clientHeight - EXPANDED_SPACER_OFFSET)}px`;
        container.scrollTop = container.scrollHeight;
    }, []);

    const hideScrollButton = useCallback(() => {
        if (showTimerRef.current !== undefined) {
            clearTimeout(showTimerRef.current);
            showTimerRef.current = undefined;
        }
        setShowScrollButton(false);
    }, []);

    const handleScroll = useCallback(() => {
        if (isCloseToBottom()) {
            hideScrollButton();
            return;
        }
        if (showTimerRef.current !== undefined) return;
        showTimerRef.current = setTimeout(() => {
            showTimerRef.current = undefined;
            if (!isCloseToBottom()) setShowScrollButton(true);
        }, SCROLL_BUTTON_SHOW_DELAY);
    }, [isCloseToBottom, hideScrollButton]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const mo = new MutationObserver(() => {
            handleSpacerBehavior();
            handleScroll();
        });
        const observeTarget = observeRef?.current ?? container;
        const observeOptions: MutationObserverInit = observeRef?.current ? { childList: true } : { childList: true, subtree: true };
        mo.observe(observeTarget, observeOptions);

        const ro = new ResizeObserver(() => handleSpacerBehavior());
        ro.observe(container);
        container.addEventListener("scroll", handleScroll);

        return () => {
            mo.disconnect();
            ro.disconnect();
            container.removeEventListener("scroll", handleScroll);
            if (showTimerRef.current !== undefined) clearTimeout(showTimerRef.current);
        };
    }, [handleSpacerBehavior, handleScroll, observeRef]);

    useEffect(() => {
        if (snapToTopTrigger === undefined || snapToTopTrigger === 0) return;
        hideScrollButton();
        const id = requestAnimationFrame(() => snapToTop());
        return () => cancelAnimationFrame(id);
    }, [snapToTopTrigger, snapToTop, hideScrollButton]);

    useEffect(() => {
        if (!isForceScrollToBottomEnabled) return;
        const id = requestAnimationFrame(() => scrollToBottom());
        return () => cancelAnimationFrame(id);
    }, [isForceScrollToBottomEnabled, scrollToBottom]);

    return (
        <div className={`relative flex flex-col flex-1 min-h-0 min-w-0 ${className}`}>
            <div
                ref={containerRef}
                data-testid="scroll-area"
                className="flex flex-col flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto custom-scrollbar custom-scrollbar-no-gutter"
                onScroll={handleScroll}
            >
                {children}

                <div ref={spacerRef} className="shrink-0" />
            </div>

            {showScrollButton && (
                <button
                    type="button"
                    data-testid="scroll-to-bottom"
                    aria-label="Scroll to bottom"
                    title="Scroll to bottom"
                    className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 size-8 rounded-full bg-app-background-secondary border border-border-default shadow flex items-center justify-center text-text-secondary hover:text-text-states-hover hover:border-border-hover transition-colors"
                    onClick={() => scrollToBottom()}
                >
                    <Icon size={14}>
                        <ChevronDownIcon />
                    </Icon>
                </button>
            )}
        </div>
    );
};
