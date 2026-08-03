import type { IoIntelWorkingContext } from "@interopio/working-context";
import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";
import { LOADING_STATES, type LoadingState } from "../types";

export type WorkingContextSlice = {
    isWorkingContextEnabled: boolean;
    workingContext: Record<string, IoIntelWorkingContext.Property> | null;
    workingContextLoadingState: LoadingState;
    setIsWorkingContextEnabled: (enabled: boolean) => void;
    setWorkingContext: (ctx: Record<string, IoIntelWorkingContext.Property> | null) => void;
    setWorkingContextLoadingState: (state: LoadingState) => void;
};

export const createWorkingContextSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], WorkingContextSlice> = (set) => ({
    isWorkingContextEnabled: false,
    workingContext: null,
    workingContextLoadingState: { type: LOADING_STATES.NOT_STARTED },
    setIsWorkingContextEnabled: (enabled) => set({ isWorkingContextEnabled: enabled }),
    setWorkingContext: (ctx) => set({ workingContext: ctx }),
    setWorkingContextLoadingState: (state) => set({ workingContextLoadingState: state }),
});
