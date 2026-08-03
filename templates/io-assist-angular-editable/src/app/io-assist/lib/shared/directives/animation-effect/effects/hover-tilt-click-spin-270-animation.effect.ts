import { ElementRef, Renderer2 } from "@angular/core";

import { BaseAnimationStrategy } from "../core/base-animation.effect";

const HOVER_TILT_DEG = 45;
const HOVER_TRANSITION_MS = 200;
const CLICK_SPIN_DURATION_MS = 550;
const CLICK_SPIN_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

const BASE_CLASS = "animation-effect--hover-tilt-base";
const HOVER_CLASS = "animation-effect--hover-tilt-45";
const CLICK_CLASS = "animation-effect--spin-270-return";

/**
 * HoverTilt45ClickSpin270AnimationStrategy
 *
 * Two-in-one animation behaviour for the reload/refresh icon:
 *  - Hover enter → smoothly tilts 45° clockwise
 *  - Hover leave → smoothly returns to 0°
 *  - Click       → spins 270° clockwise then returns to 0° (no full circle)
 *
 * CSS transitions handle the hover tilt; a CSS keyframe animation handles the
 * click spin so that clicking during a hover works correctly.
 */
export class HoverTilt45ClickSpin270AnimationStrategy extends BaseAnimationStrategy {
    private _isHovered = false;
    private _isClickAnimating = false;
    private _removeClickListener?: () => void;

    constructor(elementRef: ElementRef, renderer: Renderer2) {
        super(elementRef, renderer);
    }

    public setup(onComplete?: () => void): void {
        this.onCompleteCallback = onComplete;

        HoverTilt45ClickSpin270AnimationStrategy.ensureStyles();

        // Apply the base transition class so the return-to-zero is always animated
        this.renderer.addClass(this.elementRef.nativeElement, BASE_CLASS);

        // This animation type is interactive (doesn't auto-complete), so notify immediately
        this.notifyComplete();
    }

    public override onMouseEnter(): void {
        this._isHovered = true;

        if (this._isClickAnimating) {
            // Don't apply tilt while click spin is in progress; it will be restored on animationend
            return;
        }

        this.renderer.addClass(this.elementRef.nativeElement, HOVER_CLASS);
    }

    public override onMouseLeave(): void {
        this._isHovered = false;

        if (this._isClickAnimating) {
            return;
        }

        this.renderer.removeClass(this.elementRef.nativeElement, HOVER_CLASS);
    }

    public override onClick(): void {
        const el: HTMLElement = this.elementRef.nativeElement;

        // Remove hover tilt so the spin starts cleanly from 0°
        this.renderer.removeClass(el, HOVER_CLASS);

        // Remove then re-add click class so repeated clicks restart the animation
        this.renderer.removeClass(el, CLICK_CLASS);

        // Force reflow
        void el.offsetWidth;

        this._isClickAnimating = true;
        this.renderer.addClass(el, CLICK_CLASS);

        // Clean up after animation finishes
        this._removeClickListener?.();
        this._removeClickListener = this.renderer.listen(el, "animationend", () => {
            this.renderer.removeClass(el, CLICK_CLASS);
            this._isClickAnimating = false;
            this._removeClickListener?.();
            this._removeClickListener = undefined;

            // Restore hover tilt if the cursor is still over the element
            if (this._isHovered) {
                this.renderer.addClass(el, HOVER_CLASS);
            }
        });
    }

    public cleanup(): void {
        this._removeClickListener?.();
        this._removeClickListener = undefined;

        const el: HTMLElement = this.elementRef.nativeElement;
        this.renderer.removeClass(el, BASE_CLASS);
        this.renderer.removeClass(el, HOVER_CLASS);
        this.renderer.removeClass(el, CLICK_CLASS);
    }

    private static ensureStyles(): void {
        const styleId = "animation-effect-hover-tilt-spin-270-styles";

        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement("style");

        style.id = styleId;
        style.textContent = `
            /* Smooth transition for hover tilt and return */
            .${BASE_CLASS} {
                transition: transform ${HOVER_TRANSITION_MS}ms ease;
            }

            /* Hover state — 45° clockwise tilt */
            .${HOVER_CLASS} {
                transform: rotate(${HOVER_TILT_DEG}deg);
            }

            /* Click spin — 270° clockwise, then snaps back to 0° */
            @keyframes spin-270-return {
                0%   { transform: rotate(0deg); }
                65%  { transform: rotate(270deg); }
                100% { transform: rotate(0deg); }
            }

            .${CLICK_CLASS} {
                animation: spin-270-return ${CLICK_SPIN_DURATION_MS}ms ${CLICK_SPIN_EASING} forwards;
                /* CSS animation overrides the transition + hover transform */
                transition: none;
            }
        `;

        document.head.appendChild(style);
    }
}
