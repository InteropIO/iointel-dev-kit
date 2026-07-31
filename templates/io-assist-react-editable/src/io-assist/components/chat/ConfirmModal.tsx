import React from "react";

import { useIoAssistStore } from "../../context/IoAssistContext";
import { resolveConfirmModal } from "../../utils/confirmModal";
import { Modal } from "../shared/Modal";

/**
 * Async question-style dialog backed by `currentConfirmModal` store state:
 * sampling consent, elicitation, mcp-replace. Renders `{heading, text, buttons}`
 * config and resolves the promise returned by `showConfirmModal` with the
 * clicked button id.
 */
export const ConfirmModal: React.FC = () => {
    const confirmModal = useIoAssistStore((s) => s.currentConfirmModal);

    if (!confirmModal) return null;

    const close = () => resolveConfirmModal(null);
    const showCloseIcon = confirmModal.isHeaderCloseButtonDisplayed ?? false;

    const footer =
        confirmModal.buttons.length > 0
            ? confirmModal.buttons.map((btn) => {
                  const isPrimary = btn.variant === "primary";
                  return (
                      <button
                          key={btn.id}
                          data-testid={`confirm-modal-${btn.id}`}
                          type="button"
                          onClick={() => resolveConfirmModal(btn.id)}
                          className={
                              isPrimary
                                  ? "app-button flex justify-center items-center rounded-sm cursor-pointer gap-1 px-spacing-6 py-spacing-3 bg-button-submit-background text-white hover:opacity-95 transition-opacity"
                                  : "app-button flex justify-center items-center rounded-sm cursor-pointer gap-1 px-spacing-6 py-spacing-3 border border-border-default text-text-default hover:text-text-states-active hover:border-border-hover transition-colors"
                          }
                      >
                          {btn.label}
                      </button>
                  );
              })
            : null;

    return (
        <Modal open onClose={close} title={confirmModal.title} showCloseIcon={showCloseIcon} footer={footer} testId="confirm-modal">
            <div className="flex flex-col gap-2 px-6 pb-2">
                {confirmModal.heading && <span className="text-text-black-white text-lg">{confirmModal.heading}</span>}
                {confirmModal.text && <span className="text-text-default text-sm whitespace-pre-wrap break-words">{confirmModal.text}</span>}
            </div>
        </Modal>
    );
};
