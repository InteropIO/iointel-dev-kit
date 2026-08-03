import { inject, Injectable, Signal, signal, WritableSignal, DestroyRef } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { IoAiWeb, IoAiWebFactory } from "@interopio/ai-web";
import { IOConnectBrowser } from "@interopio/browser";
import { IOConnectCore } from "@interopio/core";
import { IOConnectDesktop } from "@interopio/desktop";
import { IOConnectModals } from "@interopio/modals-api";
import { IOConnectStore } from "@interopio/ng";
import { map } from "rxjs";

import { LoggerService } from "../../services/logger/logger.service";
import { AppLifecycleFacade } from "../../store/app-lifecycle/app-lifecycle.facade";

const PREFS_NAMESPACE = "ioAssist";

@Injectable({ providedIn: "root" })
export class IOConnectService {
    private readonly _ioConnectStore: IOConnectStore = inject(IOConnectStore);
    private readonly _destroyRef: DestroyRef = inject(DestroyRef);
    private readonly _logger: LoggerService = inject(LoggerService);
    private readonly _appLifecycleFacade = inject(AppLifecycleFacade);
    protected readonly LOGGER_NAME: string = "IOConnectService";
    private _prefsWriteQueue: Promise<void> = Promise.resolve();

    private _isUnsubscribed: WritableSignal<boolean> = signal<boolean>(false);

    private _isDarkMode: WritableSignal<boolean> = signal<boolean>(false);
    public get isDarkMode(): Signal<boolean> {
        return this._isDarkMode;
    }

    private get _ioConnect(): IOConnectDesktop.API | IOConnectBrowser.API {
        return this._ioConnectStore.getIOConnect();
    }

    private get _ioConnectReadyInitError(): Error | undefined {
        return this._ioConnectStore.getInitError();
    }

    public readonly isIoConnectReady: Signal<boolean>;

    constructor() {
        this.isIoConnectReady = toSignal(
            this._ioConnectStore.ready().pipe(
                map((r) => {
                    if (r.error === undefined && !this._logger.isInitialized) {
                        this._logger.setLogger(this._ioConnect.logger);
                    }

                    return r.error === undefined;
                })
            ),
            { initialValue: false }
        );

        this._destroyRef.onDestroy(() => {
            this.handleDestroy();
        });
    }

    public async subscribeToThemeChanges(): Promise<void> {
        const ioThemesAPI: IOConnectDesktop.Themes.API | IOConnectBrowser.Themes.API | undefined = this._ioConnect.themes;

        if (!ioThemesAPI) return;

        const currentTheme = await ioThemesAPI.getCurrent();

        if (!currentTheme) return;

        // Set initial theme
        this.changeTheme(currentTheme);

        // Subscribe to future changes
        ioThemesAPI.onChanged(this.changeTheme.bind(this));
    }

    public async fetchPrefs<T>(key: string): Promise<T | undefined> {
        const prefs: IOConnectDesktop.Preferences.AppPreferences | IOConnectBrowser.Prefs.AppPreferences | undefined = await this._ioConnect.prefs.get();

        if (!prefs || !prefs.data) return Promise.reject("No preferences found");

        const namespace = (prefs.data[PREFS_NAMESPACE] ?? {}) as Record<string, unknown>;

        if (!(key in namespace)) {
            this.getLogger().debug(`Prefs key "${key}" not found in namespace "${PREFS_NAMESPACE}"`);
            return undefined;
        }

        return namespace[key] as T | undefined;
    }

    public updatePrefs<T>(key: string, value: T): Promise<void> {
        const enqueued = this._prefsWriteQueue.then(async () => {
            const currentPrefs: IOConnectDesktop.Preferences.AppPreferences | IOConnectBrowser.Prefs.AppPreferences | undefined = await this._ioConnect.prefs.get();

            const prefsData = { ...currentPrefs?.data };
            const namespace = { ...((prefsData[PREFS_NAMESPACE] ?? {}) as Record<string, unknown>) };
            namespace[key] = value;
            prefsData[PREFS_NAMESPACE] = namespace;

            await this._ioConnect.prefs.update(prefsData);
        });

        // Keep _writeQueue as a void-settled tail so it never rejects and stays chainable.
        this._prefsWriteQueue = enqueued.then(
            () => undefined,
            () => undefined
        );

        return enqueued;
    }

    public handleDestroy(): void {
        this._isUnsubscribed.set(true);
    }

    public async initializeIOIntelWeb(config: IoAiWeb.WebConfig): Promise<IoAiWeb.API> {
        // Debug-only global. NOT required by IoAiWebFactory — the factory takes the
        // io.Connect instance as a direct argument and never reads `window.io`. Host
        // apps that need a global set their own. Commented out to verify nothing depends on it.
        // (window as any).io = this._ioConnect;
        return IoAiWebFactory(this._ioConnect as IOConnectBrowser.API, config);
    }

    public async isModalsAvailable(): Promise<boolean> {
        const ioBrowserAPI: IOConnectBrowser.API = this._ioConnect as IOConnectBrowser.API;

        const modalsAPI = ioBrowserAPI.modals;
        const modalsDialogsAPI = ioBrowserAPI.modals?.dialogs;

        if (!modalsAPI || !modalsDialogsAPI) {
            return false;
        }

        const status: IOConnectModals.ModalsStatus | undefined = await modalsAPI.getStatus();

        if (!status) {
            return false;
        }

        return status.platformConfigured === true;
    }

    public requestModalDialog(options: IOConnectModals.DialogRequestConfig): Promise<IOConnectModals.DialogResponse> {
        const ioBrowserAPI = this._ioConnect as IOConnectBrowser.API;
        if (!ioBrowserAPI.modals || !ioBrowserAPI.modals.dialogs) {
            throw new Error("IO Connect Modals API is not available.");
        }

        return ioBrowserAPI.modals.dialogs.request(options);
    }

    private _hasStartedIODependentTasks: boolean = false;

    public startIODependentTasks(): void {
        if (this._hasStartedIODependentTasks) return;
        this._hasStartedIODependentTasks = true;

        // Start any tasks that depend on IO being ready, e.g. subscribe to theme changes
        this.subscribeToThemeChanges();

        this._appLifecycleFacade.dispatchInitAppCoreServices();
    }

    private changeTheme = (theme: { name: string }): void => {
        if (this._isUnsubscribed()) return;

        const themeName: string = theme.name;

        if (!themeName) {
            this.getLogger().warn(`Received invalid theme name: ${themeName}`);

            return;
        }

        document.documentElement.className = "";
        document.documentElement.classList.add(themeName);

        this._isDarkMode.set(themeName === "dark");
    };

    private getLogger(): IOConnectCore.Logger.API {
        return this._logger.get(this.LOGGER_NAME);
    }
}
