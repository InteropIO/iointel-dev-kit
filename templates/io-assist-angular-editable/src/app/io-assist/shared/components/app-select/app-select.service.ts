import { inject, Injectable, Signal, signal, WritableSignal } from "@angular/core";

import { AppSelectOption } from "./types";
import { IOConnectService } from "../../services/io/io.service";
import { LoggerService } from "../../services/logger/logger.service";

const PREFS_KEY = "userChoices";

/** Registry of all app-select IDs in the application.
 *  Each ID must be unique and stable — it is used as the key in persisted user choices. */
export const APP_SELECT_IDS = {
    PERMISSION: "permission",
} as const;

export type AppSelectId = (typeof APP_SELECT_IDS)[keyof typeof APP_SELECT_IDS];

type SelectEntry = {
    signal: WritableSignal<AppSelectOption | null>;
    options: AppSelectOption[];
};

/**
 * Manages all `<app-select>` instances across the app.
 *
 * ## Usage
 * 1. Give the select a unique ID from `APP_SELECT_IDS`.
 * 2. The component calls `register()` on init and `unregister()` on destroy.
 * 3. When the user picks an option, the component calls `select()`.
 * 4. Consumers read the current value via `getSelected(id)()`.
 *
 * ```ts
 * // Reading the selected value in a service:
 * const mode = this._appSelectService.getSelected(APP_SELECT_IDS.PERMISSION)()?.value;
 * ```
 *
 * ## Persistence
 * Selections are saved in user prefs under the `userChoices` key as a flat
 * `Record<selectId, String(option.value)>`. Example with two registered selects:
 *
 * ```json
 * {
 *   "permission": "auto_accept",
 *   "language":   "en"
 * }
 * ```
 *
 * On `register()` the stored value is matched against `String(o.value)` for each option
 * and used to pre-select the matching option, overriding the `isSelected` default if one is found.
 */
@Injectable({ providedIn: "root" })
export class AppSelectService {
    private readonly _ioConnectService: IOConnectService = inject(IOConnectService);
    private readonly _logger: LoggerService = inject(LoggerService);
    private readonly LOGGER_NAME = "AppSelectService";

    private readonly _registry = new Map<string, SelectEntry>();

    public async register(id: string, options: AppSelectOption[], persist: boolean): Promise<void> {
        if (this._registry.has(id)) {
            this._logger.get(this.LOGGER_NAME).warn(`Select "${id}" is already registered.`);
            return;
        }

        const defaultOption = options.find((o) => o.isSelected) ?? null;
        const entry: SelectEntry = { signal: signal(defaultOption), options };
        this._registry.set(id, entry);

        if (!persist) return;

        const choices = await this._fetchChoices();
        const savedValue = choices ? choices[id] : undefined;
        const savedOption = options.find((o) => String(o.value) === savedValue);

        if (!savedOption) return;

        entry.signal.set(savedOption);
    }

    public unregister(id: string): void {
        this._registry.delete(id);
    }

    public async select(id: string, option: AppSelectOption, persist: boolean): Promise<void> {
        const entry = this._registry.get(id);

        if (!entry) return;

        entry.signal.set(option);

        if (!persist) return;

        await this._saveChoice(id, String(option.value));
    }

    public getSelected(id: string): Signal<AppSelectOption | null> {
        return this._registry.get(id)?.signal ?? signal(null);
    }

    private async _saveChoice(id: string, value: string): Promise<void> {
        try {
            const current = await this._fetchChoices();

            await this._ioConnectService.updatePrefs(PREFS_KEY, { ...current, [id]: value });
        } catch {
            this._logger.get(this.LOGGER_NAME).warn(`Could not save prefs for select "${id}".`);
        }
    }

    private async _fetchChoices(): Promise<Record<string, string> | undefined> {
        try {
            return await this._ioConnectService.fetchPrefs<Record<string, string>>(PREFS_KEY);
        } catch {
            return undefined;
        }
    }
}
