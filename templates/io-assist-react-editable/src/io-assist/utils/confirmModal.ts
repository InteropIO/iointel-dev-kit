import { ioAssistStore, type ConfirmModalConfig } from "../stores";

// Distinct sentinel returned when a second showConfirmModal call arrives while
// one is still open. Callers can detect this and avoid mapping silent preemption
// onto business actions (e.g. "user denied sampling" or "create new instance").
export const MODAL_PREEMPTED = Symbol("confirmModal.preempted");
export type ConfirmModalResult = string | null | typeof MODAL_PREEMPTED;

type Resolver = (result: ConfirmModalResult) => void;
let activeResolver: Resolver | null = null;

export function showConfirmModal(config: ConfirmModalConfig): Promise<ConfirmModalResult> {
    if (activeResolver) {
        activeResolver(MODAL_PREEMPTED);
        activeResolver = null;
    }

    ioAssistStore.getState().showConfirmModal(config);

    return new Promise<ConfirmModalResult>((resolve) => {
        activeResolver = resolve;
    });
}

export function resolveConfirmModal(buttonId: string | null): void {
    const resolver = activeResolver;
    activeResolver = null;
    ioAssistStore.getState().closeConfirmModal();
    if (resolver) resolver(buttonId);
}
