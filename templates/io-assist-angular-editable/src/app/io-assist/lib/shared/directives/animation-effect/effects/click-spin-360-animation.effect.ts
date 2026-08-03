import { ElementRef, Renderer2 } from "@angular/core";

import { BaseAnimationStrategy } from "../core/base-animation.effect";

const SPIN_DURATION_MS = 500;
const SPIN_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * ClickSpin360AnimationStrategy
 *
 * Rotates the host element 360 degrees each time the user clicks it.
 * Uses a CSS keyframe animation class that is added on click and removed
 * when the transition ends, so repeated clicks each trigger a fresh spin.
 */
export class ClickSpin360AnimationStrategy extends BaseAnimationStrategy {
    private readonly _className = "animation-effect--spin-360";
    private _removeListener?: () => void;

    constructor(elementRef: ElementRef, renderer: Renderer2) {
        super(elementRef, renderer);
    }

    public setup(onComplete?: () => void): void {
        this.onCompleteCallback = onComplete;

        // Inject the keyframe rule once into the document if not already present
        ClickSpin360AnimationStrategy.ensureKeyframes();

        // Notify complete immediately – this animation is click-driven, not auto-completing
        this.notifyComplete();
    }

    public override onClick(): void {
        const el: HTMLElement = this.elementRef.nativeElement;

        // Remove then re-add class so repeated clicks restart the animation
        this.renderer.removeClass(el, this._className);

        // Force reflow so the browser registers the class removal before re-adding
        void el.offsetWidth;

        this.renderer.addClass(el, this._className);

        // Clean up class after animation completes
        this._removeListener?.();
        this._removeListener = this.renderer.listen(el, "animationend", () => {
            this.renderer.removeClass(el, this._className);
            this._removeListener?.();
            this._removeListener = undefined;
        });
    }

    public cleanup(): void {
        this._removeListener?.();
        this._removeListener = undefined;

        const el: HTMLElement = this.elementRef.nativeElement;
        this.renderer.removeClass(el, this._className);
    }

    private static ensureKeyframes(): void {
        const styleId = "animation-effect-spin-360-keyframes";

        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement("style");

        style.id = styleId;
        style.textContent = `
            @keyframes spin-360 {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
            }
            .animation-effect--spin-360 {
                animation: spin-360 ${SPIN_DURATION_MS}ms ${SPIN_EASING};
                display: inline-flex;
            }
        `;

        document.head.appendChild(style);
    }
}
