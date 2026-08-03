import { CommonModule } from "@angular/common";
import { Component, computed, ElementRef, HostListener, inject, input, InputSignal, OnInit, Signal, signal, viewChild, WritableSignal } from "@angular/core";

import { TOOLTIP_DISPLAY_MODES, TOOLTIP_POSITIONS } from "./enum";
import { TooltipDisplayModeType, TooltipPositionType } from "./types";
import { ComponentEffectManagerService as EffectService } from "../../services/component-effect-manager/component-effect-manager.service";
import { LoggerService } from "../../services/logger/logger.service";

/**
 * AppTooltipComponent - A flexible tooltip component that displays contextual information.
 *
 * This component intelligently positions a tooltip around a trigger element in one of four directions:
 * TOP, BOTTOM, LEFT, or RIGHT. It automatically measures the tooltip's size and calculates the best
 * position to keep it visible within the viewport.
 *
 * **How it works:**
 * 1. When hovering over the trigger element, the tooltip is rendered but kept invisible
 * 2. The component measures the tooltip's actual width and height
 * 3. It calculates the ideal position based on the trigger element's location and the chosen direction
 * 4. If the tooltip would go outside the viewport, it adjusts the position to keep it visible (with 8px padding)
 * 5. Once positioned, the tooltip smoothly fades in with a 150ms transition
 * 6. The tooltip automatically repositions itself when the window is scrolled or resized
 *
 * **TOP Placement Calculation (Visual Schema):**
 * ```
 * ┌─────────────────────────────────────────┐
 * │ Viewport                                │
 * │                                         │
 * │      ┌───────────────┐                  │
 * │      │   Tooltip     │ ← y = triggerRect.top - tooltipHeight - offset
 * │      └───────────────┘                  │
 * │             ↑                           │
 * │         (offset)                        │
 * │             ↓                           │
 * │      ┌─────────────┐                    │
 * │      │   Trigger   │                    │
 * │      └─────────────┘                    │
 * │      ↑             ↑                    │
 * │   rect.left   rect.left + width         │
 * │                                         │
 * │ x = rect.left + (width / 2) - (tooltipWidth / 2)
 * │     └─────┬─────┘   └────┬────┘         │
 * │      trigger center   center tooltip    │
 * └─────────────────────────────────────────┘
 *
 * Horizontal (x): Center tooltip above trigger
 *   • Start at trigger's left edge
 *   • Move right by half the trigger's width (finds center)
 *   • Move left by half the tooltip's width (centers tooltip)
 *
 * Vertical (y): Place tooltip above trigger
 *   • Start at trigger's top edge
 *   • Move up by tooltip's full height
 *   • Move up by offset distance (gap between elements)
 *
 * Clamping: Keep tooltip within viewport bounds
 *   • Ensure x is at least 8px from left edge
 *   • Ensure x leaves 8px space on right edge
 * ```
 *
 * **Usage:**
 * ```html
 * <app-tooltip [tooltipPosition]="'top'" [triggerOffset]="14">
 *   <button tooltip-trigger>Hover me</button>
 *   <span tooltip-content>This is the tooltip text</span>
 * </app-tooltip>
 * ```
 *
 * @input tooltipPosition - Where to show the tooltip: 'top' | 'bottom' | 'left' | 'right' (default: 'top')
 * @input triggerOffset - Distance in pixels between the trigger element and tooltip (default: 14)
 * @input displayMode - Controls when the tooltip is shown: 'hover' | 'event' | 'both' (default: 'hover')
 * @input forceVisible - Programmatically shows the tooltip when displayMode is 'event' or 'both'
 */
@Component({
    selector: "app-tooltip",
    templateUrl: "./app-tooltip.component.html",
    styleUrl: "./app-tooltip.component.css",
    imports: [CommonModule],
    providers: [
        {
            provide: EffectService,
            useFactory: () => new EffectService("AppTooltipComponent"),
        },
    ],
})
export class AppTooltipComponent implements OnInit {
    protected readonly TOOLTIP_POSITIONS = TOOLTIP_POSITIONS;
    protected readonly TOOLTIP_DISPLAY_MODES = TOOLTIP_DISPLAY_MODES;

    private readonly _logger = inject(LoggerService).get("AppTooltipComponent");

    // Provided in current component
    private readonly _effectService: EffectService = inject(EffectService);

    public readonly tooltipPosition: InputSignal<TooltipPositionType> = input<TooltipPositionType>(this.TOOLTIP_POSITIONS.TOP);
    public readonly triggerOffset: InputSignal<number> = input<number>(14);
    /**
     * Controls when the tooltip is shown.
     * - 'hover'  : shown on mouse hover only (default, backward-compatible)
     * - 'event'  : shown programmatically via forceVisible only — hover is suppressed
     * - 'both'   : shown on hover and/or via forceVisible
     */
    public readonly displayMode: InputSignal<TooltipDisplayModeType> = input<TooltipDisplayModeType>(TOOLTIP_DISPLAY_MODES.HOVER);
    public readonly forceVisible: InputSignal<boolean> = input<boolean>(false);
    /**
     * When true the tooltip will never show. Defaults to false.
     * Useful when tooltip content is conditionally projected.
     */
    public readonly disabled: InputSignal<boolean> = input<boolean>(false);

    protected readonly isVisible: WritableSignal<boolean> = signal<boolean>(false);
    protected readonly isPositioned: WritableSignal<boolean> = signal<boolean>(false);
    protected readonly coordinates: WritableSignal<{ x: number; y: number }> = signal<{
        x: number;
        y: number;
    }>({
        x: 0,
        y: 0,
    });
    protected readonly tooltipWidth: WritableSignal<number> = signal<number>(0);
    protected readonly tooltipHeight: WritableSignal<number> = signal<number>(0);

    /**
     * Pixel offset (left or top) for the arrow element, calculated after the
     * tooltip position is clamped to the viewport. This keeps the arrow
     * pointing at the trigger's centre even when the tooltip box is pushed
     * away from the edge.
     */
    protected readonly arrowOffset: WritableSignal<number> = signal<number>(0);
    protected readonly arrowStyle: Signal<{ left?: string; top?: string }> = computed(() => {
        const position: TooltipPositionType = this.tooltipPosition();
        const offset: number = this.arrowOffset();

        if (position === TOOLTIP_POSITIONS.TOP || position === TOOLTIP_POSITIONS.BOTTOM) {
            return { left: offset + "px" };
        }

        return { top: offset + "px" };
    });

    protected readonly isHoverEnabled: Signal<boolean> = computed(() => this.displayMode() !== TOOLTIP_DISPLAY_MODES.EVENT);

    // View Children
    protected readonly tooltipTriggerElement: Signal<ElementRef | undefined> = viewChild("triggerElement");
    protected readonly tooltipContainer: Signal<ElementRef | undefined> = viewChild("tooltipContainer");

    public ngOnInit(): void {
        this.registerEffects();
    }

    private registerEffects(): void {
        this._effectService.registerEffect("AppTooltipComponent.showOrHide.on.forceVisibleChange", () => {
            const mode = this.displayMode();

            if (mode === TOOLTIP_DISPLAY_MODES.EVENT || mode === TOOLTIP_DISPLAY_MODES.BOTH) {
                if (this.forceVisible()) {
                    this._showTooltip();
                } else {
                    this._hideTooltip();
                }
            }
        });
    }

    /** Hover-triggered show — suppressed when displayMode is 'event' or tooltip is disabled. */
    protected async showTooltip(): Promise<void> {
        if (this.displayMode() === TOOLTIP_DISPLAY_MODES.EVENT) return;
        if (this.disabled()) return;
        await this._showTooltip();
    }

    /** Hover-triggered hide — suppressed when displayMode is 'event' or forceVisible keeps it open. */
    protected hideTooltip(): void {
        const mode = this.displayMode();

        if (mode === TOOLTIP_DISPLAY_MODES.EVENT) return;
        // In 'both' mode don't dismiss via hover while forceVisible is still active
        if (mode === TOOLTIP_DISPLAY_MODES.BOTH && this.forceVisible()) return;

        this._hideTooltip();
    }

    private async _showTooltip(): Promise<void> {
        this.isVisible.set(true);
        this.isPositioned.set(false);

        // Wait for next frame to ensure DOM is rendered
        await new Promise((resolve) => requestAnimationFrame(resolve));

        const el = this.tooltipContainer()?.nativeElement;

        if (!el) return;

        this.measureTooltip();
        this.updatePosition();

        this.isPositioned.set(true);
    }

    private _hideTooltip(): void {
        this.isVisible.set(false);
        this.isPositioned.set(false);
    }

    @HostListener("window:scroll")
    @HostListener("window:resize")
    onViewportChange() {
        if (!this.isVisible()) return;

        this.updatePosition();
    }

    private updatePosition(): void {
        const triggerEl = this.tooltipTriggerElement()?.nativeElement;
        const tooltipWidth: number = this.tooltipWidth();
        const tooltipHeight: number = this.tooltipHeight();

        if (!triggerEl || tooltipWidth === 0 || tooltipHeight === 0) {
            this._logger.warn(`Tooltip positioning skipped: triggerEl=${!!triggerEl}, tooltipWidth=${tooltipWidth}, tooltipHeight=${tooltipHeight}`);
            return;
        }

        const triggerRect = triggerEl.getBoundingClientRect();
        const offset: number = this.triggerOffset();

        let x: number = 0;
        let y: number = 0;

        let position: TooltipPositionType = this.tooltipPosition();

        if (!position) {
            this._logger.warn(`Invalid tooltip position: ${position}. Falling back to TOP`);

            position = TOOLTIP_POSITIONS.TOP;
        }

        if (position === TOOLTIP_POSITIONS.TOP) {
            // Center horizontally above trigger
            x = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
            y = triggerRect.top - tooltipHeight - offset;

            // Clamp horizontally to viewport
            x = Math.max(8, Math.min(x, window.innerWidth - tooltipWidth - 8));
        }

        if (position === TOOLTIP_POSITIONS.BOTTOM) {
            // Center horizontally below trigger
            x = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
            y = triggerRect.bottom + offset;

            // Clamp horizontally to viewport
            x = Math.max(8, Math.min(x, window.innerWidth - tooltipWidth - 8));
        }

        if (position === TOOLTIP_POSITIONS.LEFT) {
            // Center vertically to the left of trigger
            x = triggerRect.left - tooltipWidth - offset;
            y = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;

            // Clamp vertically to viewport
            y = Math.max(8, Math.min(y, window.innerHeight - tooltipHeight - 8));
        }

        if (position === TOOLTIP_POSITIONS.RIGHT) {
            // Center vertically to the right of trigger
            x = triggerRect.right + offset;
            y = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;

            // Clamp vertically to viewport
            y = Math.max(8, Math.min(y, window.innerHeight - tooltipHeight - 8));
        }

        this.updateArrowOffset(position, triggerRect, { x, y });

        this.coordinates.set({ x, y });
    }

    /**
     * Recomputes the arrow offset after the tooltip has been clamped to the
     * viewport, so the arrow always points at the trigger's centre regardless
     * of how far the tooltip box was shifted.
     */
    private updateArrowOffset(position: TooltipPositionType, triggerRect: DOMRect, tooltipOrigin: { x: number; y: number }): void {
        const arrowMargin = 10; // keep arrow at least 10 px from each edge
        const isHorizontal = position === TOOLTIP_POSITIONS.TOP || position === TOOLTIP_POSITIONS.BOTTOM;
        const rawOffset = isHorizontal ? triggerRect.left + triggerRect.width / 2 - tooltipOrigin.x : triggerRect.top + triggerRect.height / 2 - tooltipOrigin.y;
        const maxOffset = isHorizontal ? this.tooltipWidth() : this.tooltipHeight();

        this.arrowOffset.set(Math.max(arrowMargin, Math.min(rawOffset, maxOffset - arrowMargin)));
    }

    private measureTooltip(): void {
        const el = this.tooltipContainer()?.nativeElement;
        if (!el) return;

        const rect = el.getBoundingClientRect();

        this.tooltipWidth.set(rect.width);
        this.tooltipHeight.set(rect.height);
    }
}
