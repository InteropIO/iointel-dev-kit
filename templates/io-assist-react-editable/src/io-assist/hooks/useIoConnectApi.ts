import type { IOConnectBrowser } from "@interopio/browser";
import { useMemo } from "react";

import { setPermissionMode } from "../actions/setPermissionMode";
import { toggleFavoritePrompt } from "../actions/toggleFavoritePrompt";
import { useIoAssistStore } from "../context/IoAssistContext";
import { ioAssistStore } from "../stores";
import type { PermissionMode } from "../stores/permission-mode";

export type UseIoConnectApi = {
    api: IOConnectBrowser.API | null;
    isReady: boolean;
    toggleFavoritePrompt: (name: string) => Promise<void>;
    setPermissionMode: (mode: PermissionMode) => Promise<void>;
};

/**
 * Accessor hook for the io.Connect SDK instance with persistence-aware
 * orchestrations baked in. Pairs with `useIoConnect()` which boots the
 * SDK once at the app root.
 */
export function useIoConnectApi(): UseIoConnectApi {
    const api = useIoAssistStore((s) => s.ioConnectApi);

    return useMemo<UseIoConnectApi>(
        () => ({
            api,
            isReady: api !== null,
            toggleFavoritePrompt: (name) => toggleFavoritePrompt(ioAssistStore, name),
            setPermissionMode: (mode) => setPermissionMode(ioAssistStore, mode),
        }),
        [api]
    );
}
