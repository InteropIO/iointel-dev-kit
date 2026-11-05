import { Injectable, signal, Signal, WritableSignal } from "@angular/core";

import { APP_BUTTON_TYPES } from "../../components/app-button/enum";

export type PermissionRequestButton = {
    id: string;
    label: string;
    buttonType: APP_BUTTON_TYPES;
};

export type PermissionRequestState = {
    description: string;
    buttons: PermissionRequestButton[];
    cancelId: string;
};

/**
 * Backs the inline permission-request card shown in the chat thread (used by sampling and
 * elicitation) so both can ask the user a yes/no/maybe-shaped question without a floating
 * panel or a platform-native dialog.
 *
 * Only one request can be active at a time (concurrent ones are rejected
 * outright), and the underlying tool call that raised it is blocked until the client responds or
 * the server times it out on its own — so the next tool result to arrive after a request is
 * shown is always either that tool call succeeding/failing or the request's own timeout. Callers
 * should invoke {@link clear} whenever a tool result arrives to dismiss a still-pending card
 * without having to fake a timeout duration we don't actually know.
 */
@Injectable({
    providedIn: "root",
})
export class PermissionRequestService {
    private readonly _current: WritableSignal<PermissionRequestState | null> = signal<PermissionRequestState | null>(null);
    public readonly current: Signal<PermissionRequestState | null> = this._current.asReadonly();

    private _resolve?: (id: string) => void;

    public request(description: string, buttons: PermissionRequestButton[], cancelId: string): Promise<string> {
        this.clear();

        return new Promise<string>((resolve) => {
            this._resolve = resolve;
            this._current.set({ description, buttons, cancelId });
        });
    }

    public respond(id: string): void {
        const resolve = this._resolve;

        this._current.set(null);
        this._resolve = undefined;
        resolve?.(id);
    }

    public clear(): void {
        const current = this._current();

        if (!current) return;

        this.respond(current.cancelId);
    }
}

