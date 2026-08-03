import React, { createContext, useContext, type ReactNode } from "react";
import { useStore } from "zustand";

import { type IoAssistStore, ioAssistStore } from "../stores";
import type { IoAssistStaticConfig, IoAssistDynamicConfig } from "../types";

// ─── Context ──────────────────────────────────────────────────────────────────

export const IoAssistConfigContext = createContext<IoAssistStaticConfig | null>(null);
export const IoAssistDynamicConfigContext = createContext<IoAssistDynamicConfig | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export type IoAssistProviderProps = {
    staticConfig: IoAssistStaticConfig;
    dynamicConfig: IoAssistDynamicConfig;
    children: ReactNode;
};

export const IoAssistProvider: React.FC<IoAssistProviderProps> = ({ staticConfig, dynamicConfig, children }) => {
    return (
        <IoAssistConfigContext.Provider value={staticConfig}>
            <IoAssistDynamicConfigContext.Provider value={dynamicConfig}>{children}</IoAssistDynamicConfigContext.Provider>
        </IoAssistConfigContext.Provider>
    );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useIoAssistStore<T>(selector: (store: IoAssistStore) => T): T {
    return useStore(ioAssistStore, selector);
}

export function useIoAssistConfig(): IoAssistStaticConfig {
    const config = useContext(IoAssistConfigContext);

    if (!config) {
        throw new Error("useIoAssistConfig must be used inside IoAssistProvider");
    }

    return config;
}

export function useIoAssistDynamicConfig(): IoAssistDynamicConfig {
    const config = useContext(IoAssistDynamicConfigContext);

    if (!config) {
        throw new Error("useIoAssistDynamicConfig must be used inside IoAssistProvider");
    }

    return config;
}
