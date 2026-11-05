import type { StateCreator } from "zustand";

import type { IoAssistStore } from "./index";

/**
 * A single action button rendered on the inline permission-request card.
 * `variant: "primary"` maps to the filled/submit style, anything else to the
 * outlined/secondary style — mirrors ng's `APP_BUTTON_TYPES.SUBMIT` vs
 * `SECONDARY` mapping on `permission-request-card.component.html`.
 */
export type PermissionRequestButton = {
    id: string;
    label: string;
    variant: "primary" | "default";
};

export type PermissionRequestState = {
    description: string;
    buttons: PermissionRequestButton[];
    cancelId: string;
};

export type PermissionRequestSlice = {
    permissionRequest: PermissionRequestState | null;
    showPermissionRequest: (state: PermissionRequestState) => void;
    closePermissionRequest: () => void;
};

export const createPermissionRequestSlice: StateCreator<IoAssistStore, [["zustand/subscribeWithSelector", never]], [], PermissionRequestSlice> = (set) => ({
    permissionRequest: null,
    showPermissionRequest: (state) => set({ permissionRequest: state }),
    closePermissionRequest: () => set({ permissionRequest: null }),
});
