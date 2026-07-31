import { ElementRef, Renderer2 } from "@angular/core";

export type AnimationStrategy = {
    /**
     * Initialize the animation by setting up required DOM elements and styles
     * @param onComplete Optional callback to invoke when animation completes (for chaining)
     */
    setup(onComplete?: () => void): void;

    /**
     * (default no-op)
     */
    onMouseEnter(): void;

    /**
     * (default no-op)
     */
    onMouseLeave(): void;

    /**
     * (default no-op)
     */
    onMouseMove(event: MouseEvent): void;

    /**
     * (default no-op)
     */
    onClick(): void;

    /**
     * Cleanup resources when animation is destroyed
     */
    cleanup(): void;
};

export abstract class BaseAnimationStrategy implements AnimationStrategy {
    protected onCompleteCallback?: () => void;

    constructor(
        protected elementRef: ElementRef,
        protected renderer: Renderer2
    ) {}

    abstract setup(onComplete?: () => void): void;

    abstract cleanup(): void;

    public onMouseEnter(): void {
        // Default no-op implementation
    }

    public onMouseLeave(): void {
        // Default no-op implementation
    }

    public onMouseMove(_event: MouseEvent): void {
        // Default no-op implementation
    }

    public onClick(): void {
        // Default no-op implementation
    }

    protected notifyComplete(): void {
        if (!this.onCompleteCallback) {
            return;
        }

        this.onCompleteCallback();
    }
}
