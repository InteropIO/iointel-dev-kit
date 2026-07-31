import { useEffect, useRef } from "react";

import { initIoAiWeb } from "../actions/initIoAiWeb";
import { useIoAssistStore, useIoAssistConfig, useIoAssistDynamicConfig } from "../context/IoAssistContext";
import { ioAssistStore } from "../stores";
import { LOADING_STATES } from "../types";

/**
 * Initialises IoAiWeb once io.Connect is ready.
 * Triggers agent listing and prompt parsing after successful init.
 *
 * Thin React shell — the actual SDK adapter lives in
 * `actions/initIoAiWeb.ts`. Mirrors ng's IoAiWebService pattern.
 */
export function useIoAiWebBootstrap(): void {
    const isIoConnectReady = useIoAssistStore((s) => s.isIoConnectReady);
    const appLoadingState = useIoAssistStore((s) => s.appLoadingState);
    const staticConfig = useIoAssistConfig();
    const dynamicConfig = useIoAssistDynamicConfig();

    const initialised = useRef(false);

    useEffect(() => {
        if (!isIoConnectReady) return;
        if (initialised.current) return;
        if (appLoadingState.type !== LOADING_STATES.NOT_STARTED) return;
        initialised.current = true;

        void initIoAiWeb(staticConfig, dynamicConfig, ioAssistStore);
    }, [isIoConnectReady, staticConfig, dynamicConfig, appLoadingState.type]);
}
