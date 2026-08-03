export enum AnimationType {
    /**
     * Rotates the element 360 degrees on click.
     * A smooth single-rotation spin triggered each time the user clicks the element.
     */
    CLICK_SPIN_360 = "click-spin-360",
    /**
     * Combined hover-tilt + click-spin animation for reload/refresh icons.
     * - Hover enter: smoothly tilts 45° clockwise.
     * - Hover leave: smoothly returns to 0°.
     * - Click: spins 270° clockwise then returns to 0° (no full circle).
     */
    HOVER_TILT_45_CLICK_SPIN_270 = "hover-tilt-45-click-spin-270",
}
