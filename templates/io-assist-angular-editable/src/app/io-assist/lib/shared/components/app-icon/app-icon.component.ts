import { CommonModule } from "@angular/common";
import { Component, computed, ElementRef, inject, input, InputSignal, OnInit, output, OutputEmitterRef, Signal, signal, ViewChild, WritableSignal } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { IOConnectCore } from "@interopio/core";

import { APP_ICON_BACKGROUND_SHAPES, APP_ICON_SIZES } from "./enum";
import { defaultIcon, iconList } from "./icons";
import { AppIcon, AppIconBackgroundShapeType, AppIconSizeType, AppIconVariantsType } from "./types";
import { IconResource } from "../../../io-assist.types";
import { ComponentEffectManagerService as EffectService } from "../../services/component-effect-manager/component-effect-manager.service";
import { LoggerService } from "../../services/logger/logger.service";
import { isInlineSvg, shouldRenderAsImage, stripSvgAttributes, validateIconResource } from "../../utils/icon.utils";
/**
 * AppIconComponent - A reusable icon component with dynamic styling support
 *
 * Basic Usage (Variant-based):
 * @example
 * ```html
 * <app-icon [variant]="APP_ICON_VARIANTS.CLOSE"></app-icon>
 * ```
 *
 * Custom Icon Usage:
 * @example
 * ```html
 * <!-- Inline SVG -->
 * <app-icon
 *     [variant]="APP_ICON_VARIANTS.PROMPT_PANEL"
 *     [customIcon]="{
 *         type: 'svg',
 *         data: '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\">...</svg>'
 *     }"
 * ></app-icon>
 *
 * <!-- Data URL (base64) -->
 * <app-icon
 *     [variant]="APP_ICON_VARIANTS.PROMPT_PANEL"
 *     [customIcon]="{
 *         type: 'data-url',
 *         data: 'data:image/png;base64,iVBORw0KGgo...'
 *     }"
 * ></app-icon>
 *
 * <!-- External URL -->
 * <app-icon
 *     [variant]="APP_ICON_VARIANTS.PROMPT_PANEL"
 *     [customIcon]="{
 *         type: 'url',
 *         data: '/icons/custom-icon.svg'
 *     }"
 * ></app-icon>
 * ```
 *
 * Advanced Usage:
 * @example
 * ```html
 * <app-icon
 *     [variant]="APP_ICON_VARIANTS.CLOSE"
 *     [size]="APP_ICON_SIZES.M"
 *     [iconFill]="'app-text-primary'"
 *     [backgroundColor]="'app-bg-secondary'"
 *     [hoverIconFill]="'app-text-primary-dark'"
 *     [disabledIconFill]="'app-text-states-disabled'"
 *     [hoverBackgroundColor]="'app-bg-hover-secondary'"
 *     [hoverBackgroundShape]="APP_ICON_BACKGROUND_SHAPES.CIRCLE"
 *     [isHoveredExternal]="isHovered"
 *     [title]="'Close window'"
 *     (onClick)="handleIconClick()"
 * ></app-icon>
 * ```
 *
 * Color Variables:
 * - Provide CSS variable names with/without the `--` prefix
 *  - Example: `[iconFill]="'app-text-primary'"` uses `var(--app-text-primary)`
 * - Colors must be defined in `_defaults.css`
 *
 * Available Inputs:
 * @input variant - Required. Icon type from APP_ICON_VARIANTS enum
 * @input size - Icon size from APP_ICON_SIZES or custom px value (default: XS)
 * @input iconFill - Fill color for normal state (default: app-text-default)
 * @input disabledIconFill - Fill color when disabled (default: app-text-states-disabled)
 * @input hoverIconFill - Fill color on hover (default: app-text-states-hover)
 * @input hoverVariant - Alternative icon variant to render on hover (optional). When provided,
 *     swaps the entire SVG to this variant while hovered. Ideal for paired outline/filled icons
 *     (e.g., PROMPT_PANEL → PROMPT_PANEL_FILLED on hover). Takes precedence over hoverIconFilled.
 * @input backgroundColor - Background color (optional)
 * @input hoverBackgroundColor - Background color on hover (optional)
 * @input hoverBackgroundShape - Shape of hover background (default: CIRCLE)
 * @input isDisabled - Disables icon and applies disabled styles (default: false)
 * @input isWrapped - Determines if host element should be 2x size of icon (default: true)
 * @input title - Custom tooltip text (optional, auto-generated from variant if not provided)
 * @input customIcon - Custom icon resource (svg/url/data-url) to render instead of variant icon
 *     When provided, takes precedence over the variant icon. Supports:
 *     - type: 'svg' - Inline SVG string
 *     - type: 'url' - Absolute URL to image file (CDN, public assets)
 *     - type: 'data-url' - Base64 encoded data URL (SVG/PNG/JPEG)
 * @input isHoveredExternal - External hover state control (optional) - use when you want to
 *     control hover state from parent component
 * @input tabIndex - Tab index for keyboard navigation (default: 0)
 *
 * @output onClick - Emits when icon is clicked (not emitted when disabled)
 *
 * Notes:
 * - Default styles applied automatically, overrides optional
 * - Hover effects only active when not disabled
 * - Icon inherits hover state from host element
 * - Custom icons automatically validate and sanitize for security
 * - Custom icons maintain consistent styling with variant icons
 */ @Component({
    selector: "app-icon",
    imports: [CommonModule],
    templateUrl: "./app-icon.component.html",
    host: {
        "[class]": "hostClasses()",
        "[style]": "hostStyles()",
        "[style.width.px]": "isWrapped() ? sizeAsNumber() * 2 : sizeAsNumber()",
        "[style.height.px]": "isWrapped() ? sizeAsNumber() * 2 : sizeAsNumber()",
        "(click)": "handleClick($event)",
        "(keydown)": "handleKeyDown($event)",
        "(mouseenter)": "onMouseEnter()",
        "(mouseleave)": "onMouseLeave()",
        "[attr.title]": "getTitle()",
        "[attr.tabindex]": "tabIndex()",
        "[attr.data-testid]": "dataTestId() || null",
    },
    providers: [
        {
            provide: EffectService,
            useFactory: () => new EffectService("AppIconComponent"),
        },
    ],
})
export class AppIconComponent implements OnInit {
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;

    private readonly _domSanitizer: DomSanitizer = inject(DomSanitizer);
    private readonly _iconList: AppIcon[] = iconList;
    private readonly _defaultIcon: AppIcon = defaultIcon;
    private readonly _logger: IOConnectCore.Logger.API = inject(LoggerService).get("AppIconComponent");

    // For icon
    public variant: InputSignal<AppIconVariantsType> = input.required<AppIconVariantsType>();
    public size: InputSignal<AppIconSizeType> = input<AppIconSizeType>(APP_ICON_SIZES.XS);
    public iconFill: InputSignal<string> = input<string>("");
    public disabledIconFill: InputSignal<string> = input<string>("");
    public hoverIconFill: InputSignal<string> = input<string>("");
    public hoverVariant: InputSignal<AppIconVariantsType | undefined> = input<AppIconVariantsType | undefined>(undefined);
    public isDisabled: InputSignal<boolean> = input<boolean>(false);
    public isWrapped: InputSignal<boolean> = input<boolean>(true);
    public title: InputSignal<string> = input<string>("");
    // eslint-disable-next-line @angular-eslint/no-input-rename -- alias is the kebab-case DOM attribute name, not a style choice
    public dataTestId: InputSignal<string> = input<string>("", { alias: "data-testid" });

    // Custom icon support (alternative to variant-based icons)
    /**
     * Custom icon resource to render instead of using variant.
     * When provided, this takes precedence over the variant icon.
     * Supports: svg (inline SVG), url (absolute URL), data-url (base64)
     */
    public customIcon: InputSignal<IconResource | undefined> = input<IconResource | undefined>(undefined);

    // For host element
    public backgroundColor: InputSignal<string> = input<string>("");
    public hoverBackgroundShape: InputSignal<AppIconBackgroundShapeType> = input<AppIconBackgroundShapeType>(APP_ICON_BACKGROUND_SHAPES.CIRCLE);
    public hoverBackgroundColor: InputSignal<string> = input<string>("");
    public onClick: OutputEmitterRef<Event> = output<Event>();
    public isHoveredExternal: InputSignal<boolean | null> = input<boolean | null>(null);
    public tabIndex: InputSignal<number> = input<number>(0);

    @ViewChild("iconDiv", { static: false }) iconDivRef!: ElementRef<HTMLDivElement>;

    // Provided in current component
    private readonly _effectService: EffectService = inject(EffectService);

    public isHostHoveredSignal: WritableSignal<boolean> = signal(false);

    protected isHovered: Signal<boolean> = computed<boolean>(() => {
        // Use external hover if provided, otherwise internal signal
        return this.isHoveredExternal() !== null ? !!this.isHoveredExternal() : this.isHostHoveredSignal();
    });

    protected hasCustomIcon: Signal<boolean> = computed(() => {
        const icon = this.customIcon();
        if (!icon) {
            return false;
        }

        // For inline SVG, check if it passed sanitization
        if (isInlineSvg(icon)) {
            return this.customIconSanitizedSvg() !== null;
        }

        // For images (URL/data-url), check if we have a valid URL
        if (shouldRenderAsImage(icon)) {
            return this.customIconImageUrl() !== null;
        }

        return false;
    });

    protected isCustomIconInlineSvg: Signal<boolean> = computed(() => {
        const icon = this.customIcon();

        return icon ? isInlineSvg(icon) : false;
    });

    protected shouldCustomIconRenderAsImage: Signal<boolean> = computed(() => {
        const icon = this.customIcon();

        return icon ? shouldRenderAsImage(icon) : false;
    });

    protected customIconSanitizedSvg: Signal<SafeHtml | null> = computed(() => {
        const icon = this.customIcon();
        if (!icon || !isInlineSvg(icon)) {
            return null;
        }

        const validation = validateIconResource(icon);
        if (!validation.valid) {
            return null;
        }

        // Strip problematic attributes from SVG (removes event handlers, script tags, etc.)
        const cleanedSvg = stripSvgAttributes(icon.data, this._logger);

        if (!cleanedSvg) {
            this._logger.warn("Custom SVG icon was rejected due to security concerns");
            return null;
        }

        // DomSanitizer.sanitize(SecurityContext.HTML) strips SVG elements entirely since
        // svg/circle/path are not in its HTML allowlist. stripSvgAttributes already handles
        // security (removes on* handlers, style, script tags), so we trust its output directly.
        return this._domSanitizer.bypassSecurityTrustHtml(cleanedSvg);
    });

    protected customIconImageUrl: Signal<string | null> = computed(() => {
        const icon = this.customIcon();
        if (!icon || !shouldRenderAsImage(icon)) {
            return null;
        }

        return icon.data;
    });

    public getTitle: Signal<string> = computed<string>(() => {
        if (this.title()) {
            return this.title();
        }

        const match: AppIcon | undefined = this._iconList.find((icon: AppIcon) => icon.name === this.variant());

        if (!match) {
            return this._defaultIcon.title;
        }

        return match.title;
    });

    protected hostClasses: Signal<string> = computed<string>(() => {
        const classListArray: string[] = [
            "flex items-center justify-center",
            this.isDisabled() ? "cursor-not-allowed" : "cursor-pointer",
            this.hoverBackgroundShape() === APP_ICON_BACKGROUND_SHAPES.CIRCLE ? "rounded-full" : "",
        ];

        return classListArray.filter((c) => c !== "").join(" ");
    });

    protected hostStyles: Signal<Record<string, string>> = computed<Record<string, string>>(() => {
        const styles: Record<string, string> = {};

        const bg: string = this.trimPrefix(this.backgroundColor());
        const hoverBg: string = this.trimPrefix(this.hoverBackgroundColor());

        if (this.isHovered() && hoverBg && !this.isDisabled()) {
            styles["background-color"] = `var(--${hoverBg})`;
        }

        if (!this.isHovered() && bg) {
            styles["background-color"] = `var(--${bg})`;
        }

        return styles;
    });

    protected getIconStyles: Signal<Record<string, string>> = computed<Record<string, string>>(() => {
        const styles: Record<string, string> = {};

        const dynamicFill: string = this.isDisabled() ? this.trimPrefix(this.disabledIconFill()) : this.trimPrefix(this.iconFill());

        const staticFill: string = this.isDisabled() ? "var(--app-text-states-disabled)" : "var(--app-text-default)";

        const fillValue: string = dynamicFill ? `var(--${dynamicFill})` : staticFill;

        // Set both 'fill' (for direct SVG attributes) and 'color' (for currentColor)
        styles["fill"] = fillValue;
        styles["color"] = fillValue;

        return styles;
    });

    /**
     * Generates CSS mask styles for image-based icons (URL/data-URL).
     * Uses CSS mask to apply the icon shape and background-color for theming.
     * This allows SVG files loaded from URLs to be themed with CSS variables.
     * Now supports hover colors to behave consistently with variant icons.
     */
    protected getImageIconMaskStyles: Signal<Record<string, string>> = computed<Record<string, string>>(() => {
        const styles: Record<string, string> = {};
        const iconUrl = this.customIconImageUrl();

        if (!iconUrl) {
            return styles;
        }

        let fillValue: string;

        if (this.isDisabled()) {
            const dynamicFill = this.trimPrefix(this.disabledIconFill());
            fillValue = dynamicFill ? `var(--${dynamicFill})` : "var(--app-text-states-disabled)";
        } else if (this.isHovered()) {
            const hoverFill = this.trimPrefix(this.hoverIconFill());
            fillValue = hoverFill ? `var(--${hoverFill})` : "var(--app-text-states-hover)";
        } else {
            const dynamicFill = this.trimPrefix(this.iconFill());
            fillValue = dynamicFill ? `var(--${dynamicFill})` : "var(--app-text-default)";
        }

        // Apply the icon as a mask and use background-color for the actual color
        styles["mask"] = `url('${iconUrl}') no-repeat center`;
        styles["mask-size"] = "contain";
        styles["-webkit-mask"] = `url('${iconUrl}') no-repeat center`;
        styles["-webkit-mask-size"] = "contain";
        styles["background-color"] = fillValue;

        return styles;
    });

    /**
     * Computes the SVG markup for variant-based icons reactively.
     * When `hoverVariant` is set and the icon is hovered, the entire SVG is swapped to
     * the hover variant. Ideal for paired outline/filled icon variants (e.g. PROMPT_PANEL →
     * PROMPT_PANEL_FILLED).
     */
    protected iconSvgContent: Signal<SafeHtml> = computed(() => {
        const activeVariant = this.isHovered() && this.hoverVariant() ? this.hoverVariant() : this.variant();

        const svgString = this._iconList.find((icon: AppIcon) => icon.name === activeVariant)?.svgPath || this._defaultIcon.svgPath;

        // Replace all fill attributes with an invalid value so SVG elements inherit
        // the fill color cascaded via CSS from the parent container div
        let processed = svgString.replace(/fill="[^"]*"/g, 'fill="defaultColor"');

        // Strip width/height so we can set explicit dimensions
        processed = processed.replace(/width="[^"]*"/g, "").replace(/height="[^"]*"/g, "");

        // Set explicit size matching the component size input
        const size: number = this.sizeAsNumber();
        processed = processed.replace(/<svg/, `<svg width="${size}" height="${size}"`);

        return this._domSanitizer.bypassSecurityTrustHtml(processed);
    });

    public ngOnInit(): void {
        this.registerEffects();
    }

    protected onMouseEnter(): void {
        if (this.isDisabled()) return;

        this.isHostHoveredSignal.set(true);
    }

    protected onMouseLeave(): void {
        if (this.isDisabled()) return;

        this.isHostHoveredSignal.set(false);
    }

    private applyIconHoverStyles(): void {
        if (!this.iconDivRef) return;

        const hoverFill = this.trimPrefix(this.hoverIconFill());
        const fillValue = hoverFill ? `var(--${hoverFill})` : "var(--app-text-states-hover)";

        // Set both fill (for SVG attributes) and color (for currentColor)
        this.iconDivRef.nativeElement.style.fill = fillValue;
        this.iconDivRef.nativeElement.style.color = fillValue;
    }

    private removeIconHoverStyles(): void {
        if (!this.iconDivRef) return;

        const dynamicFill: string = this.isDisabled() ? this.trimPrefix(this.disabledIconFill()) : this.trimPrefix(this.iconFill());

        const staticFill: string = this.isDisabled() ? "var(--app-text-states-disabled)" : "var(--app-text-default)";

        const fillValue: string = dynamicFill ? `var(--${dynamicFill})` : staticFill;

        // Set both fill (for SVG attributes) and color (for currentColor)
        this.iconDivRef.nativeElement.style.fill = fillValue;
        this.iconDivRef.nativeElement.style.color = fillValue;
    }

    protected getIconClasses(): string {
        const sizeValue: AppIconSizeType = this.size();
        const widthClass = typeof sizeValue === "string" ? parseInt(sizeValue.replace("px", ""), 10) : sizeValue;
        const heightClass = widthClass;

        return `w-[${widthClass}px] h-[${heightClass}px]`;
    }

    protected sizeAsNumber(): number {
        const sizeWithUnit: AppIconSizeType = this.size();

        if (typeof sizeWithUnit === "number") {
            return sizeWithUnit;
        }

        if (typeof sizeWithUnit === "string") {
            return parseInt(sizeWithUnit.replace("px", ""), 10);
        }

        return 0;
    }

    protected handleClick(event?: Event): void {
        if (!event) return;

        if (this.isDisabled()) {
            event?.stopPropagation();
            event?.preventDefault();

            return;
        }

        this.onClick.emit(event);
    }

    protected handleKeyDown(event: KeyboardEvent): void {
        if (!event) return;

        if (event.key !== "Enter" && event.key !== "Space" && event.key !== " ") return;

        event.preventDefault();
        this.onClick.emit(event);

        // Remove focus from the icon after click
        (event.target as HTMLElement)?.blur();
    }

    private trimPrefix(colorClass: string): string {
        return colorClass.replace(/^--/, "").trim();
    }

    private registerEffects(): void {
        this._effectService.registerEffect("AppIcon.toggleHoverStylesEffect", () => {
            if (this.isDisabled()) return;

            if (this.isHovered()) {
                this.applyIconHoverStyles();

                return;
            }

            this.removeIconHoverStyles();
        });
    }
}
