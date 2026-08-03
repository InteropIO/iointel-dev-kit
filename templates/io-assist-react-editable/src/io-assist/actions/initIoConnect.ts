// SDK adapter: bridges the io.Connect factory (browser or desktop) into the
// store. Pure side-effect module; no React. Mirrors ng's IoService.

import type { IOConnectBrowser } from "@interopio/browser";
import type { IOConnectDesktop } from "@interopio/desktop";

import { PERMISSION_MODE, type PermissionMode } from "../stores/permission-mode";
import type { IoAssistStaticConfig } from "../types";
import { fetchPref } from "../utils/ioPrefs";
import { logger } from "../utils/logger";

export type IoConnectStoreSetters = {
    setIoConnectApi: (api: IOConnectBrowser.API) => void;
    setIsIoConnectReady: (ready: boolean) => void;
    setFavoritePromptNames: (names: string[]) => void;
    setPermissionMode: (mode: PermissionMode) => void;
    setIsDarkMode: (dark: boolean) => void;
};

export async function initIoConnect(config: IoAssistStaticConfig, store: IoConnectStoreSetters): Promise<void> {
    const { setIoConnectApi, setIsIoConnectReady, setFavoritePromptNames, setPermissionMode, setIsDarkMode } = store;

    const applyAndSync = (themeName: string) => {
        applyTheme(themeName);
        setIsDarkMode(themeName === "dark");
    };

    try {
        let ioApi: IOConnectBrowser.API | IOConnectDesktop.API;

        const desktopConfig = config.connectConfig?.desktop;
        const browserConfig = config.connectConfig?.browser;

        if (desktopConfig?.factory) {
            ioApi = await desktopConfig.factory(desktopConfig.config);
        } else if (browserConfig?.factory) {
            ioApi = await browserConfig.factory(browserConfig.config);
        } else {
            throw new Error("No io.Connect factory provided. Supply connectConfig.browser or connectConfig.desktop.");
        }

        // Debug-only global. NOT required by IoAiWebFactory — the factory takes
        // `ioApi` as a direct argument and never reads `window.io`. Host apps that
        // need a global set their own. Commented out to verify nothing depends on it.
        // (window as Window & { io?: IOConnectBrowser.API | IOConnectDesktop.API }).io = ioApi;

        logger.setLogger(ioApi.logger);

        setIoConnectApi(ioApi as IOConnectBrowser.API);
        setIsIoConnectReady(true);

        const themesApi = ioApi.themes;
        if (themesApi) {
            try {
                const currentTheme = await themesApi.getCurrent();
                if (currentTheme) applyAndSync(currentTheme.name);
                themesApi.onChanged((theme: { name: string }) => applyAndSync(theme.name));
            } catch {
                // Theme API not available in all configurations — apply dark as fallback
                applyAndSync("dark");
            }
        } else {
            applyAndSync("dark");
        }

        const favoritePrompts = await fetchPref<string[]>(ioApi, "favoritePrompts");
        if (favoritePrompts) {
            setFavoritePromptNames(favoritePrompts);
        }

        const storedPermissionMode = await fetchPref<PermissionMode>(ioApi, "permissionMode");
        if (storedPermissionMode === PERMISSION_MODE.ASK || storedPermissionMode === PERMISSION_MODE.AUTO_ACCEPT) {
            setPermissionMode(storedPermissionMode);
        }
    } catch (error) {
        setIsIoConnectReady(false);
        console.error("[io-assist-react] io.Connect initialisation failed:", error);
    }
}

function applyTheme(themeName: string): void {
    document.documentElement.className = "";
    document.documentElement.classList.add(themeName);
}
