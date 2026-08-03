import type { IoAiWeb } from "@interopio/ai-web";
import type { IOConnectBrowser } from "@interopio/browser";
import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";
import { LOADING_STATES, type LoadingState } from "../types";

export type AppLifecycleSlice = {
    appLoadingState: LoadingState;
    isIoConnectReady: boolean;
    isDarkMode: boolean;
    ioConnectApi: IOConnectBrowser.API | null;
    ioAiWebApi: IoAiWeb.API | null;
    setAppLoadingState: (state: LoadingState) => void;
    setIsIoConnectReady: (ready: boolean) => void;
    setIsDarkMode: (dark: boolean) => void;
    setIoConnectApi: (api: IOConnectBrowser.API | null) => void;
    setIoAiWebApi: (api: IoAiWeb.API | null) => void;
};

export const createAppLifecycleSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], AppLifecycleSlice> = (set) => ({
    appLoadingState: { type: LOADING_STATES.NOT_STARTED },
    isIoConnectReady: false,
    isDarkMode: false,
    ioConnectApi: null,
    ioAiWebApi: null,
    setAppLoadingState: (state) => set({ appLoadingState: state }),
    setIsIoConnectReady: (ready) => set({ isIoConnectReady: ready }),
    setIsDarkMode: (dark) => set({ isDarkMode: dark }),
    setIoConnectApi: (api) => set({ ioConnectApi: api }),
    setIoAiWebApi: (api) => set({ ioAiWebApi: api }),
});
