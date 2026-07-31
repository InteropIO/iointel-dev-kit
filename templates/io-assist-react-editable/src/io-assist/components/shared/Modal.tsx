import React, { useEffect } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

type ModalProps = {
    open: boolean;
    onClose?: () => void;
    title?: string;
    showCloseIcon?: boolean;
    footer?: React.ReactNode;
    testId?: string;
    children: React.ReactNode;
};

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, showCloseIcon = false, footer, testId = "modal", children }) => {
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
            className="panel-overlay-container fixed inset-0 z-50 flex items-center justify-center bg-black/[0.32]"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
            onKeyDown={(e) => e.key === "Escape" && onClose?.()}
        >
            <dialog
                aria-modal="true"
                aria-label={title}
                open
                className="static flex flex-col box-border overflow-hidden bg-panel-background rounded-2xl border border-panel-border shadow-panel-box-shadow w-auto min-w-[320px] md:min-w-[540px] max-w-[960px] max-h-[90vh] p-0 m-0"
            >
                <div className="flex justify-end items-center gap-2 px-6 pt-6 text-text-black-white text-xl font-weight-600 shrink-0">
                    {title && <span className="flex flex-1 items-center text-text-black-white leading-[24px] truncate">{title}</span>}
                    {showCloseIcon && onClose && (
                        <IconButton size={20} containerSize={28} variant="plain" onClick={onClose} title="Close" className="text-text-black-white">
                            <CloseIcon />
                        </IconButton>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar mt-3">{children}</div>

                {footer && <div className="flex justify-end gap-2 shrink-0 w-full px-6 pb-6 pt-3">{footer}</div>}
            </dialog>
        </div>,
        document.body
    );
};
