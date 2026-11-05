import { ioAssistStore } from "../stores";
import type { PermissionRequestButton } from "../stores/permission-request";

// Module-level resolver for the single in-flight permission request. Mirrors ng's
// `PermissionRequestService`: a singleton that backs the inline permission-request card used by
// BOTH sampling and elicitation. Only one request can be active at a time.
let activeResolve: ((id: string) => void) | null = null;
let activeCancelId: string | null = null;

/**
 * Shows the inline permission-request card in the message thread and resolves with the id of the
 * button the user clicked. If another request is already pending, it is first resolved with its
 * own `cancelId` (see `clearPermissionRequest`) before the new one is shown.
 */
export function requestPermission(description: string, buttons: PermissionRequestButton[], cancelId: string): Promise<string> {
    clearPermissionRequest();

    return new Promise<string>((resolve) => {
        activeResolve = resolve;
        activeCancelId = cancelId;
        ioAssistStore.getState().showPermissionRequest({ description, buttons, cancelId });
    });
}

/** Resolves the pending request (if any) with the given button id and hides the card. */
export function respondPermissionRequest(id: string): void {
    const resolve = activeResolve;
    activeResolve = null;
    activeCancelId = null;
    ioAssistStore.getState().closePermissionRequest();
    resolve?.(id);
}

/**
 * Auto-dismisses any pending permission request by resolving it with its own fallback `cancelId`.
 * Must be called whenever: a tool result arrives (the only way a tool call resolves is via this
 * card's own response or the server timing it out and completing the call anyway), the response
 * generation is aborted by the user, or the active thread changes. No-op if nothing is pending.
 */
export function clearPermissionRequest(): void {
    if (!activeResolve || activeCancelId === null) return;
    respondPermissionRequest(activeCancelId);
}
