import { ElementRef, Renderer2 } from "@angular/core";

import { AnimationStrategy } from "./base-animation.effect";
import { ChainedAnimationStrategy } from "./chained-animation.effect";
import { AnimationType } from "../animation-type.enum";
import { ClickSpin360AnimationStrategy } from "../effects/click-spin-360-animation.effect";
import { HoverTilt45ClickSpin270AnimationStrategy } from "../effects/hover-tilt-click-spin-270-animation.effect";

export class AnimationStrategyFactory {
    public static create(animationType: AnimationType | AnimationType[], elementRef: ElementRef, renderer: Renderer2): AnimationStrategy {
        if (!animationType) {
            throw new Error(`Animation type is required`);
        }

        // Handles animation chaining
        if (Array.isArray(animationType)) {
            const validAnimations = animationType.filter((type) => Object.values(AnimationType).includes(type));

            return new ChainedAnimationStrategy(validAnimations, elementRef, renderer);
        }

        if (!Object.values(AnimationType).includes(animationType)) {
            throw new Error(`Unknown animation type: ${animationType}`);
        }

        if (animationType === AnimationType.CLICK_SPIN_360) {
            return new ClickSpin360AnimationStrategy(elementRef, renderer);
        }

        if (animationType === AnimationType.HOVER_TILT_45_CLICK_SPIN_270) {
            return new HoverTilt45ClickSpin270AnimationStrategy(elementRef, renderer);
        }

        throw new Error(`Unhandled animation type: ${animationType}`);
    }
}
