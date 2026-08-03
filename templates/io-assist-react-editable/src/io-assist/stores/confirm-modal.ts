import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";
import type { PanelContent } from "../types";

export type ConfirmModalButton = {
    id: string;
    label: string;
    variant: "primary" | "default";
};

export type ConfirmModalConfig = {
    title: string;
    heading: string;
    text: string;
    buttons: ConfirmModalButton[];
    /** Show an X close icon in the header. Defaults to false (matches ng). */
    isHeaderCloseButtonDisplayed?: boolean;
};

export type ConfirmModalSlice = {
    isThreadHistoryVisible: boolean;
    activePanelContent: PanelContent;
    currentConfirmModal: ConfirmModalConfig | null;
    setIsThreadHistoryVisible: (visible: boolean) => void;
    setActivePanelContent: (content: PanelContent) => void;
    showConfirmModal: (config: ConfirmModalConfig) => void;
    closeConfirmModal: () => void;
};

export const createConfirmModalSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], ConfirmModalSlice> = (set) => ({
    isThreadHistoryVisible: false,
    activePanelContent: null,
    currentConfirmModal: null,
    setIsThreadHistoryVisible: (visible) => set({ isThreadHistoryVisible: visible }),
    setActivePanelContent: (content) => set({ activePanelContent: content }),
    showConfirmModal: (config) => set({ currentConfirmModal: config }),
    closeConfirmModal: () => set({ currentConfirmModal: null }),
});
