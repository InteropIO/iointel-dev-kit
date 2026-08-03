export enum TOOLTIP_POSITIONS {
    TOP = "top",
    BOTTOM = "bottom",
    LEFT = "left",
    RIGHT = "right",
}

export enum TOOLTIP_DISPLAY_MODES {
    /** Show only on mouse hover (default). */
    HOVER = "hover",
    /** Show only programmatically via the forceVisible input. No hover. */
    EVENT = "event",
    /** Show on hover and/or programmatically via forceVisible. */
    BOTH = "both",
}
