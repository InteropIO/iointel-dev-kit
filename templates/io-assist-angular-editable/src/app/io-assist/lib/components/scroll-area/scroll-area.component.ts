import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, inject, input, InputSignal, signal, Signal, viewChild, WritableSignal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { filter, Subscription } from "rxjs";

import { AppIconComponent } from "../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../shared/components/app-icon/enum";
import { UI_STRINGS } from "../../shared/constants/ui-strings";
import { SubscriptionCleanupService } from "../../shared/services/subscription-cleanup/subscription-cleanup.service";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent];

/**
 * A reusable scrollable area component that can:
 *    - wrap around any content/component
 *    - automatically scroll to the bottom on condition
 *    - detect if the user is close to the bottom to display a "scroll to bottom" button
 *    - observe content changes to recalculate scroll position or spacer height changes
 *
 * Usage:
 * <scroll-area [isForceScrollToBottomEnabled]="true|false"
 *              [isSpacerExpanded]="true|false">
 *    ... content ...
 * </scroll-area>
 *
 * @param isForceScrollToBottomEnabled - if true, the scroll area will automatically scroll to the bottom when new content is added, default is false.
 * @param isSpacerExpanded - if true, a spacer element will be added at the bottom to push content up, default is false.
 *                           This is useful when you want to ensure that new content is always visible without user interaction.
 *                           The spacer will collapse gradually as new content grows, until it reaches zero height. Then the content overflows as normal.
 * @param elementToObserve - an optional ElementRef to observe for content changes. If not provided, the scroll area itself will be observed.
 *
 */
@Component({
    selector: "scroll-area",
    templateUrl: "./scroll-area.component.html",
    imports: [...MODULES, ...COMPONENTS],
    providers: [SubscriptionCleanupService],
    host: {
        class: "scroll-area flex flex-col flex-1 min-h-0 min-w-0 relative",
    },
})
export class ScrollAreaComponent implements AfterViewInit {
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;
    protected readonly UI_STRINGS = UI_STRINGS.GENERAL;

    public shouldExpandSpacer: InputSignal<boolean> = input(false);
    public isForceScrollToBottomEnabled: InputSignal<boolean> = input(false);
    public hasFadeEdges: InputSignal<boolean> = input(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public elementToObserve: InputSignal<ElementRef<any> | null> = input<ElementRef<any> | null>(null);

    protected readonly scrollArea: Signal<ElementRef | undefined> = viewChild<ElementRef | undefined>("scrollArea");
    protected readonly spacerElement: Signal<ElementRef | undefined> = viewChild<ElementRef | undefined>("spacerElement");
    protected isCloseToBottom: WritableSignal<boolean> = signal(true);

    private readonly FORCE_SCROLL_TO_BOTTOM_SUB_KEY = "scroll-area-force-scroll-to-bottom-subscription";
    private readonly MUTATION_OBSERVER_SUB_KEY = "scroll-area-mutation-observer-subscription";

    private readonly _subscriptionCleanupService: SubscriptionCleanupService = inject(SubscriptionCleanupService);

    private readonly _threshold: number = 20; // in pixels
    private _mutationObserver?: MutationObserver | undefined;

    constructor() {
        const forceScrollToBottomSubscription: Subscription = toObservable(this.isForceScrollToBottomEnabled)
            .pipe(filter((isEnabled) => isEnabled))
            .subscribe(() => this.scrollToBottom());

        this._subscriptionCleanupService.add(this.FORCE_SCROLL_TO_BOTTOM_SUB_KEY, () => forceScrollToBottomSubscription.unsubscribe());
    }

    public ngAfterViewInit(): void {
        if (!this.scrollArea()?.nativeElement) return;

        this._mutationObserver = new MutationObserver(() => {
            // Calculate if we are close to the bottom before the content changes
            this.isCloseToBottom.set(this._calculateIsCloseToBottom());

            this.handleSpacerBehavior();

            this.handleOnScroll(); // make sure to recalculate if we are close to bottom after content changes to show/hide button
        });


        if (!this._mutationObserver) return;

        const elToObserve: HTMLElement = this.elementToObserve() ? this.elementToObserve()?.nativeElement : this.scrollArea()?.nativeElement;

        this._mutationObserver.observe(elToObserve, {
            childList: true,
            subtree: true,
        });

        this._subscriptionCleanupService.add(this.MUTATION_OBSERVER_SUB_KEY, () => this._mutationObserver?.disconnect());
    }

    protected scrollToBottom(): void {
        if (!this.scrollArea()) return;

        this.scrollArea()?.nativeElement.scrollTo({
            top: this.scrollArea()?.nativeElement.scrollHeight,
            behavior: "instant",
        });
    }

    protected handleOnScroll(): void {
        this.isCloseToBottom.set(this._calculateIsCloseToBottom());
    }

    private _calculateIsCloseToBottom(): boolean {
        if (!this.scrollArea()) return false;

        const currentPosition: number = this.scrollArea()?.nativeElement.scrollTop + this.scrollArea()?.nativeElement.offsetHeight;

        const height: number = this.scrollArea()?.nativeElement.scrollHeight;

        return height - currentPosition < this._threshold;
    }

    private handleSpacerBehavior(): void {
        if (!this.scrollArea() || !this.scrollArea()?.nativeElement) return;

        if (!this.spacerElement() || !this.spacerElement()?.nativeElement) return;

        const scrollElement: HTMLElement = this.scrollArea()?.nativeElement;
        const spacerElement: HTMLElement = this.spacerElement()?.nativeElement;

        if (this.shouldExpandSpacer()) {
            // Push up the spacer to the height of the scroll area minus a small offset to completely hiding content
            // 118px because 32px come from the last element padding bottom and we want a total of 150
            spacerElement.style.minHeight = `${scrollElement.clientHeight - 118}px`;

            this.scrollToBottom();
            return;
        }

        const contentHeight: number = scrollElement.scrollHeight - spacerElement.offsetHeight;
        const idealHeight: number = Math.max(0, scrollElement.clientHeight - contentHeight);

        // We should not forget the threshold here as it plays part in showing the scroll to bottom button
        if (Math.abs(idealHeight - spacerElement.offsetHeight) <= this._threshold) return;

        spacerElement.style.minHeight = `${idealHeight}px`;
    }
}
