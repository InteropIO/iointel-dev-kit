import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";
import { LOADING_STATES, type LoadingState, type UIThread } from "../types";

export type ThreadSlice = {
    threads: UIThread[];
    activeThreadId: string | null;
    threadLoadingState: LoadingState;
    setThreads: (threads: UIThread[]) => void;
    updateThread: (id: string, changes: Partial<UIThread>) => void;
    removeThread: (id: string) => void;
    setActiveThreadId: (id: string | null) => void;
    setThreadLoadingState: (state: LoadingState) => void;
};

export const createThreadSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], ThreadSlice> = (set) => ({
    threads: [],
    activeThreadId: null,
    threadLoadingState: { type: LOADING_STATES.NOT_STARTED },
    setThreads: (threads) => set({ threads }),
    updateThread: (id, changes) =>
        set((s) => ({
            threads: s.threads.map((t) => (t.id === id ? { ...t, ...changes } : t)),
        })),
    removeThread: (id) => set((s) => ({ threads: s.threads.filter((t) => t.id !== id) })),
    setActiveThreadId: (id) => set({ activeThreadId: id }),
    setThreadLoadingState: (state) => set({ threadLoadingState: state }),
});
