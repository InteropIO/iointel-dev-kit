import { useEffect, useRef } from "react";

import { initIoConnect } from "../actions/initIoConnect";
import { useIoAssistConfig, useIoAssistStore } from "../context/IoAssistContext";

/**
 * Manages the io.Connect lifecycle:
 * 1. Initialises IOBrowser or IODesktop from static config
 * 2. Sets isIoConnectReady when connected
 * 3. Subscribes to theme changes → applies dark/light class to <html>
 *
 * Thin React shell — the actual SDK adapter lives in
 * `actions/initIoConnect.ts`. Mirrors ng's IoService pattern.
 */
export function useIoConnectBootstrap(): void {
    const config = useIoAssistConfig();
    const setIoConnectApi = useIoAssistStore((s) => s.setIoConnectApi);
    const setIsIoConnectReady = useIoAssistStore((s) => s.setIsIoConnectReady);
    const setFavoritePromptNames = useIoAssistStore((s) => s.setFavoritePromptNames);
    const setPermissionMode = useIoAssistStore((s) => s.setPermissionMode);
    const setIsDarkMode = useIoAssistStore((s) => s.setIsDarkMode);
    const initialised = useRef(false);

    useEffect(() => {
        if (initialised.current) return;
        initialised.current = true;

        void initIoConnect(config, {
            setIoConnectApi,
            setIsIoConnectReady,
            setFavoritePromptNames,
            setPermissionMode,
            setIsDarkMode,
        });
    }, [config, setIoConnectApi, setIsIoConnectReady, setFavoritePromptNames, setPermissionMode, setIsDarkMode]);
}
