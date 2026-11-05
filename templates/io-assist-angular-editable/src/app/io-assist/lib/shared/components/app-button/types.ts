import { APP_BUTTON_TYPES } from "./enum";

/** "small" = 24px tall (e.g. header), "default" = 36px. */
export type AppButtonSize = "default" | "small";

export type AppButtonType = APP_BUTTON_TYPES.DEFAULT | APP_BUTTON_TYPES.SUBMIT | APP_BUTTON_TYPES.DANGER | APP_BUTTON_TYPES.SECONDARY;
