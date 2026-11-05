import { Highlight } from "prism-react-renderer";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { CopyButton } from "./CopyButton";
import { codePanelPrismTheme } from "../messages/codePanelPrismTheme";

type CodePanelProps = {
    /** Caption shown in the header. */
    label: string;
    /** The code/text content to render. */
    code: string;
    /** Prism grammar name to highlight with (default: "text", rendered as plain). */
    language?: string;
    /** Hide the label/copy header when the host already provides its own actions (default: true). */
    showHeader?: boolean;
    /**
     * Embedded in a container that already owns its own border/background and header actions
     * (e.g. a trace-step tabpanel) — ports ng's `isEmbedded`: no border/radius/background of its
     * own and tighter padding (default: false).
     */
    embedded?: boolean;
    className?: string;
};

/**
 * Shared line-numbered, syntax-highlighted code/JSON viewer. Ports ng's `app-code-panel`:
 * a themed panel (dark by default, light under `.light`) with a copy button in the header
 * and a per-line gutter so long wrapped lines keep their line number aligned.
 */
export const CodePanel: React.FC<CodePanelProps> = ({ label, code, language = "text", showHeader = true, embedded = false, className }) => {
    const codeAreaRef = useRef<HTMLDivElement>(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    const normalizedLanguage = language.trim().toLowerCase();
    const prismLanguage = !normalizedLanguage || normalizedLanguage === "text" || normalizedLanguage === "plaintext" ? "text" : normalizedLanguage;

    const updateScrollState = useCallback(() => {
        const el = codeAreaRef.current;
        if (!el) return;
        setCanScrollUp(el.scrollTop > 1);
        setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    }, []);

    useEffect(() => {
        const el = codeAreaRef.current;
        if (!el) return;

        const ro = new ResizeObserver(updateScrollState);
        ro.observe(el);
        el.addEventListener("scroll", updateScrollState, { passive: true });
        updateScrollState();

        return () => {
            ro.disconnect();
            el.removeEventListener("scroll", updateScrollState);
        };
    }, [updateScrollState, code]);

    return (
        <div
            data-testid="app-code-panel"
            className={[
                "app-code-panel flex flex-col w-full",
                embedded ? "gap-1.5 pt-1.5 px-4 pb-3.5" : "gap-2 p-3 border border-[var(--app-code-panel-border)] rounded-xl bg-[var(--app-code-panel-bg)]",
                className ?? "",
            ].join(" ")}
        >
            {showHeader && (
                <div className="flex items-center justify-between w-full flex-shrink-0">
                    <span className="text-[12px] leading-4 text-[var(--app-code-panel-label)]">{label}</span>
                    <CopyButton textToCopy={code} testId="app-code-panel-copy" />
                </div>
            )}

            <div
                ref={codeAreaRef}
                className={[
                    "app-code-panel__code-area custom-scrollbar w-full max-h-[296px] overflow-x-hidden overflow-y-auto",
                    canScrollUp ? "app-code-panel__code-area--fade-top" : "",
                    canScrollDown ? "app-code-panel__code-area--fade-bottom" : "",
                ].join(" ")}
                style={{ scrollbarGutter: "stable", marginRight: "-9px", paddingRight: "3px" }}
            >
                <Highlight code={code} language={prismLanguage} theme={codePanelPrismTheme}>
                    {({ tokens, getLineProps, getTokenProps }) => (
                        <div className="flex flex-col w-full">
                            {tokens.map((line, i) => (
                                <div key={i} {...getLineProps({ line })} className="flex items-start w-full">
                                    <span aria-hidden="true" className="app-code-panel__gutter-number flex-shrink-0 w-6 font-mono text-[12px] leading-[18px] text-[var(--app-code-panel-gutter)] text-right select-none">
                                        {i + 1}
                                    </span>
                                    <span className="flex-shrink-0 w-3.5" />
                                    <code
                                        data-testid="app-code-panel-content"
                                        className={[
                                            "block flex-1 min-w-0 whitespace-pre-wrap break-words font-mono font-normal leading-[18px] text-[var(--app-code-panel-text)]",
                                            prismLanguage === "text" ? "text-[11px]" : "text-[12px]",
                                        ].join(" ")}
                                    >
                                        {line.map((token, key) => (
                                            <span key={key} {...getTokenProps({ token })} />
                                        ))}
                                    </code>
                                </div>
                            ))}
                        </div>
                    )}
                </Highlight>
            </div>
        </div>
    );
};
