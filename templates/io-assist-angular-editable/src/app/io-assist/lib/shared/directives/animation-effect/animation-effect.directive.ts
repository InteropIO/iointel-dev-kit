import { Directive, ElementRef, HostListener, inject, input, InputSignal, OnDestroy, OnInit, output, OutputEmitterRef, Renderer2 } from "@angular/core";

import { AnimationType } from "./animation-type.enum";
import { AnimationStrategyFactory } from "./core/animation-effect.factory";
import { AnimationStrategy } from "./core/base-animation.effect";

/**
 * AnimationEffectDirective
 *
 * A directive that applies animated visual effects to any HTML element.
 * Supports multiple animation types through a strategy pattern.
 * Supports animation chaining by accepting an array of animation types.
 * Emits events when animations start and complete.
 *
 * Usage:
 * ```html
 * <!-- Single animation -->
 * <div [animationEffect]="AnimationType.HOVER_MOUSE_FOLLOW">Content</div>
 *
 * <!-- Chained animations -->
 * <div [animationEffect]="[AnimationType.MOUNT_360_GLOW, AnimationType.HOVER_MOUSE_FOLLOW]">Content</div>
 *
 * <!-- With event handlers -->
 * <div
 *   [animationEffect]="AnimationType.MOUNT_360_GLOW"
 *   (animationStarted)="onAnimationStart()"
 *   (animationCompleted)="onAnimationComplete()"
 * >Content</div>
 * ```
 *
 * @example
 * // With default animation
 * <button animationEffect>Click me</button>
 *
 * @example
 * // With specific animation type
 * <div [animationEffect]="AnimationType.HOVER_MOUSE_FOLLOW">Hover me</div>
 *
 * @example
 * // With chained animations and events
 * <div
 *   [animationEffect]="[AnimationType.MOUNT_360_GLOW, AnimationType.HOVER_MOUSE_FOLLOW]"
 *   (animationStarted)="handleStart()"
 *   (animationCompleted)="handleComplete()"
 * >Chained effect</div>
 */
@Directive({
    selector: "[animationEffect]",
    standalone: true,
})
export class AnimationEffectDirective implements OnInit, OnDestroy {
    /**
     * The type of animation to apply. Can be a single AnimationType or an array for chaining.
     * Defaults to CLICK_SPIN_360.
     */
    public animationEffect: InputSignal<AnimationType | AnimationType[]> = input<AnimationType | AnimationType[]>(AnimationType.CLICK_SPIN_360);

    /**
     * Emits when the animation starts (during ngOnInit).
     */
    public animationStarted: OutputEmitterRef<void> = output<void>();

    /**
     * Emits when the animation completes.
     * For auto-completing animations (like MOUNT_360_GLOW), emits when the animation finishes.
     * For interactive animations (like HOVER_MOUSE_FOLLOW), emits immediately as they don't auto-complete.
     * For chained animations, emits when all animations in the chain complete.
     */
    public animationCompleted: OutputEmitterRef<void> = output<void>();

    private animationStrategy!: AnimationStrategy;
    private _elementRef: ElementRef = inject(ElementRef);
    private _renderer: Renderer2 = inject(Renderer2);

    public ngOnInit(): void {
        this.animationStrategy = AnimationStrategyFactory.create(this.animationEffect(), this._elementRef, this._renderer);

        // Emit animation started event
        this.animationStarted.emit();

        // Setup animation with completion callback
        this.animationStrategy.setup(() => {
            // Emit animation completed event
            this.animationCompleted.emit();
        });
    }

    public ngOnDestroy(): void {
        if (!this.animationStrategy) {
            return;
        }

        this.animationStrategy.cleanup();
    }

    @HostListener("mouseenter")
    protected onMouseEnter(): void {
        this.animationStrategy.onMouseEnter();
    }

    @HostListener("mouseleave")
    protected onMouseLeave(): void {
        this.animationStrategy.onMouseLeave();
    }

    @HostListener("click")
    protected onClick(): void {
        this.animationStrategy.onClick();
    }

    @HostListener("mousemove", ["$event"])
    protected onMouseMove(event: MouseEvent): void {
        this.animationStrategy.onMouseMove(event);
    }
}
