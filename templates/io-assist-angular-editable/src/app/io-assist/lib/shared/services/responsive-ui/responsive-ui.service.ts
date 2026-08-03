import { computed, effect, Injectable, Signal, signal, WritableSignal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { fromEvent, map } from "rxjs";

/**
 * Tailwind CSS breakpoints
 * @see https://tailwindcss.com/docs/responsive-design
 */
export enum BREAKPOINT {
    XS = "xs", // Extra small devices (< 640px)
    SM = "sm", // Small devices (≥ 640px)
    MD = "md", // Medium devices (≥ 768px)
    LG = "lg", // Large devices (≥ 1024px)
    XL = "xl", // Extra large devices (≥ 1280px)
    XXL = "2xl", // 2X Extra large devices (≥ 1536px)
}

/**
 * Tailwind CSS breakpoint values in pixels
 */
const BREAKPOINT_VALUES: Record<BREAKPOINT, number> = {
    [BREAKPOINT.XS]: 0,
    [BREAKPOINT.SM]: 640,
    [BREAKPOINT.MD]: 768,
    [BREAKPOINT.LG]: 1024,
    [BREAKPOINT.XL]: 1280,
    [BREAKPOINT.XXL]: 1536,
};

/**
 * Service to handle media query checks following Tailwind CSS breakpoint conventions
 *
 * Provides reactive signals for:
 * - Current breakpoint detection
 * - Individual breakpoint checks (isXs, isSm, isMd, etc.)
 * - Min-width checks (isSmUp, isMdUp, etc.)
 * - Max-width checks (isXsDown, isSmDown, etc.)
 */
@Injectable({
    providedIn: "root",
})
export class ResponsiveUIService {
    // Listen to window resize events
    private readonly _resizeSignal: Signal<number> = toSignal(
        fromEvent(window, "resize").pipe(
            map(() => {
                return window.innerWidth;
            })
        ),
        { initialValue: window.innerWidth }
    );

    // Current breakpoint as writable signal
    private readonly _currentBreakpoint: WritableSignal<BREAKPOINT> = signal(this.getCurrentBreakpoint());

    // Individual breakpoint checks (exact match)
    private readonly _isXs: Signal<boolean> = computed(() => this._currentBreakpoint() === BREAKPOINT.XS);
    private readonly _isSm: Signal<boolean> = computed(() => this._currentBreakpoint() === BREAKPOINT.SM);
    private readonly _isMd: Signal<boolean> = computed(() => this._currentBreakpoint() === BREAKPOINT.MD);
    private readonly _isLg: Signal<boolean> = computed(() => this._currentBreakpoint() === BREAKPOINT.LG);
    private readonly _isXl: Signal<boolean> = computed(() => this._currentBreakpoint() === BREAKPOINT.XL);
    private readonly _is2xl: Signal<boolean> = computed(() => this._currentBreakpoint() === BREAKPOINT.XXL);

    // Min-width checks (breakpoint and up) as writable signals
    private readonly _isSmUp: WritableSignal<boolean> = signal(this.matchesMinWidth(BREAKPOINT.SM));
    private readonly _isMdUp: WritableSignal<boolean> = signal(this.matchesMinWidth(BREAKPOINT.MD));
    private readonly _isLgUp: WritableSignal<boolean> = signal(this.matchesMinWidth(BREAKPOINT.LG));
    private readonly _isXlUp: WritableSignal<boolean> = signal(this.matchesMinWidth(BREAKPOINT.XL));
    private readonly _is2xlUp: WritableSignal<boolean> = signal(this.matchesMinWidth(BREAKPOINT.XXL));

    // Max-width checks (breakpoint and down) as writable signals
    private readonly _isXsDown: WritableSignal<boolean> = signal(this.matchesMaxWidth(BREAKPOINT.XS));
    private readonly _isSmDown: WritableSignal<boolean> = signal(this.matchesMaxWidth(BREAKPOINT.SM));
    private readonly _isMdDown: WritableSignal<boolean> = signal(this.matchesMaxWidth(BREAKPOINT.MD));
    private readonly _isLgDown: WritableSignal<boolean> = signal(this.matchesMaxWidth(BREAKPOINT.LG));
    private readonly _isXlDown: WritableSignal<boolean> = signal(this.matchesMaxWidth(BREAKPOINT.XL));

    constructor() {
        // Use effect to update breakpoints on window resize
        effect(() => {
            this._resizeSignal(); // Explicitly track the signal

            // Update current breakpoint
            const currentBreakpoint = this.getCurrentBreakpoint();
            this._currentBreakpoint.set(currentBreakpoint);

            // Update min-width checks
            this._isSmUp.set(this.matchesMinWidth(BREAKPOINT.SM));
            this._isMdUp.set(this.matchesMinWidth(BREAKPOINT.MD));
            this._isLgUp.set(this.matchesMinWidth(BREAKPOINT.LG));
            this._isXlUp.set(this.matchesMinWidth(BREAKPOINT.XL));
            this._is2xlUp.set(this.matchesMinWidth(BREAKPOINT.XXL));

            // Update max-width checks
            this._isXsDown.set(this.matchesMaxWidth(BREAKPOINT.XS));
            this._isSmDown.set(this.matchesMaxWidth(BREAKPOINT.SM));
            this._isMdDown.set(this.matchesMaxWidth(BREAKPOINT.MD));
            this._isLgDown.set(this.matchesMaxWidth(BREAKPOINT.LG));
            this._isXlDown.set(this.matchesMaxWidth(BREAKPOINT.XL));
        });
    }

    // Public getters for current breakpoint
    public get currentBreakpoint(): BREAKPOINT {
        return this._currentBreakpoint();
    }

    // Public getters for individual breakpoint checks
    public get isXs(): boolean {
        return this._isXs();
    }

    public get isSm(): boolean {
        return this._isSm();
    }

    public get isMd(): boolean {
        return this._isMd();
    }

    public get isLg(): boolean {
        return this._isLg();
    }

    public get isXl(): boolean {
        return this._isXl();
    }

    public get is2xl(): boolean {
        return this._is2xl();
    }

    // Getters for min-width checks
    public get isSmUp(): boolean {
        return this._isSmUp();
    }

    public get isMdUp(): boolean {
        return this._isMdUp();
    }

    public get isLgUp(): boolean {
        return this._isLgUp();
    }

    public get isXlUp(): boolean {
        return this._isXlUp();
    }

    public get is2xlUp(): boolean {
        return this._is2xlUp();
    }

    // Getters for max-width checks
    public get isXsDown(): boolean {
        return this._isXsDown();
    }

    public get isSmDown(): boolean {
        return this._isSmDown();
    }

    public get isMdDown(): boolean {
        return this._isMdDown();
    }

    public get isLgDown(): boolean {
        return this._isLgDown();
    }

    public get isXlDown(): boolean {
        return this._isXlDown();
    }

    /**
     * Get the current breakpoint based on window width
     */
    private getCurrentBreakpoint(): BREAKPOINT {
        const width = window.innerWidth;

        if (width >= BREAKPOINT_VALUES[BREAKPOINT.XXL]) return BREAKPOINT.XXL;
        if (width >= BREAKPOINT_VALUES[BREAKPOINT.XL]) return BREAKPOINT.XL;
        if (width >= BREAKPOINT_VALUES[BREAKPOINT.LG]) return BREAKPOINT.LG;
        if (width >= BREAKPOINT_VALUES[BREAKPOINT.MD]) return BREAKPOINT.MD;
        if (width >= BREAKPOINT_VALUES[BREAKPOINT.SM]) return BREAKPOINT.SM;

        return BREAKPOINT.XS;
    }

    /**
     * Check if the current viewport matches the minimum width for a breakpoint
     */
    private matchesMinWidth(breakpoint: BREAKPOINT): boolean {
        return window.innerWidth >= BREAKPOINT_VALUES[breakpoint];
    }

    /**
     * Check if the current viewport matches the maximum width for a breakpoint
     * Max width is defined as one pixel less than the next breakpoint
     */
    private matchesMaxWidth(breakpoint: BREAKPOINT): boolean {
        const breakpoints = Object.values(BREAKPOINT);
        const currentIndex = breakpoints.indexOf(breakpoint);

        // If it's the last breakpoint, no max width
        if (currentIndex === breakpoints.length - 1) {
            return window.innerWidth >= BREAKPOINT_VALUES[breakpoint];
        }

        const nextBreakpoint = breakpoints[currentIndex + 1];
        return window.innerWidth < BREAKPOINT_VALUES[nextBreakpoint];
    }

    /**
     * Check if viewport matches a custom media query
     */
    public matches(query: string): boolean {
        return window.matchMedia(query).matches;
    }
}
