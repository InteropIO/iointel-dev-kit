import React, { useEffect } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

type ModalProps = {
    open: boolean;
    onClose?: () => void;
    title?: string;
    description?: string;
    showCloseIcon?: boolean;
    footer?: React.ReactNode;
    testId?: string;
    /** Fixes the panel's height instead of letting it size to content, e.g. "440px". */
    fixedHeight?: string;
    /** Fixes the panel's width instead of the default responsive `calc(100vw - 32px)` sizing. */
    fixedWidth?: string;
    /** When the content manages its own internal scroll area (e.g. a list with a sticky search bar), the panel body becomes a non-scrolling flex column instead of applying its own scrollbar/fade-edges. */
    isContentSelfScrolling?: boolean;
    children: React.ReactNode;
};

export const Modal: React.FC<ModalProps> = ({
    open,
    onClose,
    title,
    description,
    showCloseIcon = false,
    footer,
    testId = "modal",
    fixedHeight,
    fixedWidth,
    isContentSelfScrolling = false,
    children,
}) => {
    useEffect(() => {
        if (!open || !onClose) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            data-testid={testId}
            role="presentation"
            // `cdk-overlay-backdrop` class kept for parity with the ng app so shared e2e
            // test-bed helpers can target the click-outside-to-close area on both apps.
            className="io-assist-root panel-overlay-container cdk-overlay-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/[0.32]"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
            onKeyDown={(e) => e.key === "Escape" && onClose?.()}
        >
            <dialog
                aria-modal="true"
                aria-label={title}
                open
                className="static flex flex-col box-border overflow-hidden bg-panel-background rounded-2xl border border-panel-border shadow-panel-box-shadow p-0 m-0"
                style={{ width: fixedWidth ?? "calc(100vw - 32px)", maxWidth: fixedWidth ?? "700px", maxHeight: "90vh", height: fixedHeight }}
            >
                <div className="app-panel__header flex justify-end items-center gap-2 px-4 pt-4 text-text-black-white shrink-0">
                    {title && (
                        <span data-testid="panel-header-title" className="flex flex-1 items-center text-text-black-white text-[15px] font-medium leading-[22px] truncate">
                            {title}
                        </span>
                    )}
                    {showCloseIcon && onClose && (
                        <IconButton testId="panel-close-button" size={12} containerSize={20} shape="rounded-square" hoverFill onClick={onClose} title="Close" className="mr-2 text-text-black-white">
                            <CloseIcon />
                        </IconButton>
                    )}
                </div>

                {description && (
                    <div className="flex-shrink-0 px-4 pt-[2px]">
                        <p className="text-text-secondary text-[12px] leading-[16px]">{description}</p>
                    </div>
                )}

                <div
                    className={[
                        "flex-1 min-h-0 mt-1",
                        isContentSelfScrolling ? "flex flex-col overflow-hidden" : "overflow-y-auto overflow-x-hidden custom-scrollbar scroll-fade-edges",
                    ].join(" ")}
                >
                    <div className={isContentSelfScrolling ? "flex flex-col flex-1 min-h-0" : "px-3 pb-6"}>{children}</div>
                </div>

                {footer && <div className="flex justify-end gap-2 shrink-0 w-full px-4 pb-4 pt-4">{footer}</div>}
            </dialog>
        </div>,
        document.body
    );
};
