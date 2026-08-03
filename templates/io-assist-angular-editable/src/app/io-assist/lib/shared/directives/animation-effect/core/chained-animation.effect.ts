import { ElementRef, Renderer2 } from "@angular/core";

import { AnimationType } from "../animation-type.enum";
import { AnimationStrategy, BaseAnimationStrategy } from "./base-animation.effect";
import { ClickSpin360AnimationStrategy } from "../effects/click-spin-360-animation.effect";
import { HoverTilt45ClickSpin270AnimationStrategy } from "../effects/hover-tilt-click-spin-270-animation.effect";

/**
 * ChainedAnimationStrategy
 *
 * Executes multiple animations in sequence, one after another.
 * Each animation completes before the next one starts.
 *
 * Visual Effect:
 * 1. First animation plays to completion
 * 2. Cleanup of first animation
 * 3. Second animation starts and plays to completion
 * 4. Repeat for all animations in the chain
 * 5. Final animation remains active
 *
 * Usage:
 * Pass an array of AnimationType values to the directive.
 * Example: [AnimationType.MOUNT_360_GLOW, AnimationType.HOVER_MOUSE_FOLLOW]
 *
 * Notes:
 * - Animations that don't complete (e.g., HOVER_MOUSE_FOLLOW) will be the final animation
 * - Each animation is properly cleaned up before the next one starts
 * - Mouse events are forwarded to the current active animation strategy
 */
export class ChainedAnimationStrategy extends BaseAnimationStrategy {
    private animationTypes: AnimationType[];
    private currentStrategy?: AnimationStrategy;
    private currentIndex = 0;

    constructor(animationTypes: AnimationType[], elementRef: ElementRef, renderer: Renderer2) {
        super(elementRef, renderer);

        this.animationTypes = animationTypes;
    }

    public setup(onComplete?: () => void): void {
        this.onCompleteCallback = onComplete;

        if (this.animationTypes.length === 0) {
            this.notifyComplete();

            return;
        }

        this.playNextAnimation();
    }

    public cleanup(): void {
        if (!this.currentStrategy) {
            return;
        }

        this.currentStrategy.cleanup();
        this.currentStrategy = undefined;
    }

    public override onMouseEnter(): void {
        if (!this.currentStrategy) {
            return;
        }

        this.currentStrategy.onMouseEnter();
    }

    public override onMouseLeave(): void {
        if (!this.currentStrategy) {
            return;
        }

        this.currentStrategy.onMouseLeave();
    }

    public override onMouseMove(event: MouseEvent): void {
        if (!this.currentStrategy) {
            return;
        }

        this.currentStrategy.onMouseMove(event);
    }

    public override onClick(): void {
        if (!this.currentStrategy) {
            return;
        }

        this.currentStrategy.onClick();
    }

    private playNextAnimation(): void {
        if (this.currentIndex >= this.animationTypes.length) {
            this.notifyComplete();

            return;
        }

        const animationType = this.animationTypes[this.currentIndex];
        this.currentIndex++;

        // Clean up previous strategy if exists
        if (this.currentStrategy) {
            this.currentStrategy.cleanup();
        }

        // Create new strategy
        this.currentStrategy = this.createStrategy(animationType);

        // Setup with completion callback
        const isLastAnimation = this.currentIndex >= this.animationTypes.length;

        this.currentStrategy.setup(() => {
            if (!isLastAnimation) {
                // More animations to play - continue chain
                this.playNextAnimation();

                return;
            }

            this.notifyComplete();
        });
    }

    private createStrategy(animationType: AnimationType): AnimationStrategy {
        switch (animationType) {
            case AnimationType.CLICK_SPIN_360:
                return new ClickSpin360AnimationStrategy(this.elementRef, this.renderer);
            case AnimationType.HOVER_TILT_45_CLICK_SPIN_270:
                return new HoverTilt45ClickSpin270AnimationStrategy(this.elementRef, this.renderer);
            default:
                throw new Error(`Unknown animation type: ${animationType}`);
        }
    }
}
