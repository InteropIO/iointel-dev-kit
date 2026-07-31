import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";

/**
 * Permission mode controls how tool/action permission requests (sampling and
 * elicitation) are handled.
 * - `ask`         : always prompt the user with a modal (default).
 * - `auto_accept` : auto-approve every request without showing a modal.
 *
 * String values match the io-assist-ng implementation so the persisted pref is
 * portable across both apps.
 */
export const PERMISSION_MODE = {
    ASK: "ask",
    AUTO_ACCEPT: "auto_accept",
} as const;

export type PermissionMode = (typeof PERMISSION_MODE)[keyof typeof PERMISSION_MODE];

export type PermissionModeSlice = {
    permissionMode: PermissionMode;
    setPermissionMode: (mode: PermissionMode) => void;
};

export const createPermissionModeSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], PermissionModeSlice> = (set) => ({
    permissionMode: PERMISSION_MODE.ASK,
    setPermissionMode: (mode) => set({ permissionMode: mode }),
});
