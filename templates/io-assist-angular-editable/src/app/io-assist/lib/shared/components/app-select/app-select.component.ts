import { CommonModule } from "@angular/common";
import { Component, computed, DestroyRef, ElementRef, HostListener, inject, input, InputSignal, OnInit, output, OutputEmitterRef, Signal, signal, viewChild, WritableSignal } from "@angular/core";

import { AppSelectService } from "./app-select.service";
import { AppSelectOption } from "./types";
import { ComponentEffectManagerService as EffectService } from "../../services/component-effect-manager/component-effect-manager.service";
import { AppIconComponent } from "../app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../app-icon/enum";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent];

const PLACEHOLDER = "Select...";

/**
 * AppSelectComponent — a styled select trigger + dropdown.
 *
 * Usage:
 * ```html
 * <app-select
 *   selectId="mySelect"
 *   [options]="options"
 *   [label]="'Model'"
 *   (optionSelected)="onSelect($event)"
 * />
 * ```
 *
 * @input selectId           - Unique ID for this select instance. Required when persist is true.
 * @input options             - Array of selectable options (required). Mark one with `isSelected: true` to pre-select it.
 * @input persist             - Persist the selected option via the preferences API (default: true). Requires selectId.
 * @input label               - Optional label rendered above the trigger
 * @input outline             - Show border outline on trigger; when false (default) uses solid background design
 * @input invertOrder         - Place check icon left and item icon right (default: false)
 * @input preferredPlacement  - Preferred dropdown direction: 'above' | 'below' (default: 'below'). Flips if not enough space.
 * @output optionSelected     - Emits the chosen option on selection
 */
@Component({
    selector: "app-select",
    templateUrl: "./app-select.component.html",
    styleUrl: "./app-select.component.css",
    imports: [...MODULES, ...COMPONENTS],
    providers: [
        {
            provide: EffectService,
            useFactory: () => new EffectService("AppSelectComponent"),
        },
    ],
})
export class AppSelectComponent implements OnInit {
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;

    private readonly _el = inject(ElementRef);
    private readonly _effectService = inject(EffectService);
    private readonly _selectService = inject(AppSelectService);
    private readonly _destroyRef = inject(DestroyRef);

    public readonly selectId: InputSignal<string> = input.required<string>();
    public readonly options: InputSignal<AppSelectOption[]> = input.required<AppSelectOption[]>();
    public readonly label: InputSignal<string | undefined> = input<string | undefined>(undefined);
    public readonly persist: InputSignal<boolean> = input<boolean>(true);
    public readonly outline: InputSignal<boolean> = input<boolean>(false);
    public readonly invertOrder: InputSignal<boolean> = input<boolean>(false);
    public readonly preferredPlacement: InputSignal<"above" | "below"> = input<"above" | "below">("below");

    public readonly optionSelected: OutputEmitterRef<AppSelectOption> = output<AppSelectOption>();

    protected readonly isOpen: WritableSignal<boolean> = signal(false);
    protected readonly selectedOption: WritableSignal<AppSelectOption | null> = signal(null);
    protected readonly dropdownStyle: WritableSignal<Record<string, string>> = signal({});
    protected readonly hoveredOptionTitle: WritableSignal<string | null> = signal(null);
    protected readonly focusedIndex: WritableSignal<number> = signal(-1);
    protected readonly isTriggerHovered: WritableSignal<boolean> = signal(false);
    protected readonly isTriggerFocused: WritableSignal<boolean> = signal(false);
    private _lastInputWasPointer = false;

    protected onTriggerPointerDown(): void {
        this._lastInputWasPointer = true;
    }

    protected onTriggerFocus(): void {
        if (!this._lastInputWasPointer) this.isTriggerFocused.set(true);
        this._lastInputWasPointer = false;
    }

    protected onTriggerBlur(): void {
        this.isTriggerFocused.set(false);
    }

    private readonly _triggerRef: Signal<ElementRef | undefined> = viewChild("triggerEl");
    private readonly _dropdownRef: Signal<ElementRef | undefined> = viewChild("dropdownEl");

    protected readonly displayTitle: Signal<string> = computed(() => {
        const selected = this.selectedOption();
        if (!selected) return PLACEHOLDER;
        return selected.miniTitle ?? selected.title;
    });

    protected readonly hasAnyIcon: Signal<boolean> = computed(() => this.options().some((o) => o.icon !== undefined));

    protected readonly chevronVariant: Signal<string> = computed(() => (this.isOpen() ? APP_ICON_VARIANTS.CHEVRON_UP : APP_ICON_VARIANTS.CHEVRON_DOWN));

    public ngOnInit(): void {
        const id = this.selectId();

        this._selectService.register(id, this.options(), this.persist()).then(() => {
            const stored = this._selectService.getSelected(id)();
            if (stored) this.selectedOption.set(stored);
        });

        this._destroyRef.onDestroy(() => this._selectService.unregister(id));

        this._effectService.registerEffect("AppSelectComponent.initDefaultOption", () => {
            const def = this.options().find((o) => o.isSelected);
            if (def && !this.selectedOption()) this.selectedOption.set(def);
        });
    }

    protected toggle(): void {
        this.isOpen.update((v) => !v);
        if (!this.isOpen()) return;

        this.focusedIndex.set(-1);
        requestAnimationFrame(() => this.updateDropdownPosition());
    }

    protected select(option: AppSelectOption): void {
        this.selectedOption.set(option);
        this.optionSelected.emit(option);
        this.isOpen.set(false);
        this._selectService.select(this.selectId(), option, this.persist());
    }

    protected isSelected(option: AppSelectOption): boolean {
        const selected = this.selectedOption();
        if (!selected) return false;
        if (option.value !== undefined && selected.value !== undefined) {
            return String(option.value) === String(selected.value);
        }
        return selected.title === option.title;
    }

    private updateDropdownPosition(): void {
        const triggerEl = this._triggerRef()?.nativeElement;
        const dropdownEl = this._dropdownRef()?.nativeElement;
        if (!triggerEl || !dropdownEl) return;

        const triggerRect: DOMRect = triggerEl.getBoundingClientRect();
        const dropdownHeight: number = dropdownEl.offsetHeight;
        const dropdownWidth: number = dropdownEl.offsetWidth;
        const spaceBelow = window.innerHeight - triggerRect.bottom - 8;
        const spaceAbove = triggerRect.top - 8;

        const preferAbove = this.preferredPlacement() === "above";
        const openUpward = preferAbove ? spaceAbove >= dropdownHeight || spaceAbove > spaceBelow : spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

        const left = Math.max(8, Math.min(triggerRect.left, window.innerWidth - dropdownWidth - 8));

        this.dropdownStyle.set({
            left: `${left}px`,
            minWidth: `${triggerRect.width}px`,
            ...(openUpward ? { bottom: `${window.innerHeight - triggerRect.top + 4}px`, top: "auto" } : { top: `${triggerRect.bottom + 4}px`, bottom: "auto" }),
        });
    }

    private _scrollFocusedIntoView(): void {
        const dropdownEl = this._dropdownRef()?.nativeElement;
        if (!dropdownEl) return;
        const items = dropdownEl.querySelectorAll('[role="option"]') as NodeListOf<HTMLElement>;
        items[this.focusedIndex()]?.scrollIntoView({ block: "nearest" });
    }

    @HostListener("window:resize")
    onWindowResize(): void {
        if (this.isOpen()) requestAnimationFrame(() => this.updateDropdownPosition());
    }

    @HostListener("window:scroll")
    onWindowScroll(): void {
        if (this.isOpen()) requestAnimationFrame(() => this.updateDropdownPosition());
    }

    @HostListener("document:click", ["$event"])
    onDocumentClick(event: MouseEvent): void {
        if (!this._el.nativeElement.contains(event.target)) this.isOpen.set(false);
    }

    @HostListener("document:keydown", ["$event"])
    onKeydown(event: KeyboardEvent): void {
        if (!this.isOpen()) return;

        const opts = this.options();
        const last = opts.length - 1;

        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                this.focusedIndex.update((i) => Math.min(i + 1, last));
                this._scrollFocusedIntoView();
                break;
            case "ArrowUp":
                event.preventDefault();
                this.focusedIndex.update((i) => Math.max(i - 1, 0));
                this._scrollFocusedIntoView();
                break;
            case "Home":
                event.preventDefault();
                this.focusedIndex.set(0);
                this._scrollFocusedIntoView();
                break;
            case "End":
                event.preventDefault();
                this.focusedIndex.set(last);
                this._scrollFocusedIntoView();
                break;
            case "Enter": {
                event.preventDefault();
                const idx = this.focusedIndex();
                if (idx >= 0 && opts[idx]) this.select(opts[idx]);
                break;
            }
            case "Escape":
                this.isOpen.set(false);
                break;
        }
    }
}
