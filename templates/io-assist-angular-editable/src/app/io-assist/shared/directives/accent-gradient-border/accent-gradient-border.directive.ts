import { Directive, ElementRef, input, InputSignal, Renderer2, inject, OnInit } from "@angular/core";

import { ComponentEffectManagerService as EffectService } from "../../services/component-effect-manager/component-effect-manager.service";
import { applyStyles, createElement } from "../utils";

/**
 * AccentGradientBorderDirective
 *
 * A directive that applies a 1px gradient border using accent colors to any HTML element.
 * The gradient uses --color-app-accent-color-1 and --color-app-accent-color-2.
 *
 * Usage:
 * ```html
 * <!-- Always enabled (default) -->
 * <div accentGradientBorder>Content</div>
 *
 * <!-- Conditionally enabled -->
 * <div [accentGradientBorder]="isExpanded">Content</div>
 * ```
 *
 * DOM Structure Created:
 * - .accent-gradient-border__layer (gradient border layer, positioned behind content)
 * - .accent-gradient-border__background (solid background to mask gradient center)
 * - Existing content (z-indexed above all layers)
 */
@Directive({
    selector: "[accentGradientBorder]",
    standalone: true,
    providers: [
        {
            provide: EffectService,
            useFactory: () => new EffectService("AccentGradientBorderDirective"),
        },
    ],
})
export class AccentGradientBorderDirective implements OnInit {
    public accentGradientBorder: InputSignal<boolean> = input<boolean>(true);

    private _renderer: Renderer2 = inject(Renderer2);
    private _elementRef: ElementRef = inject(ElementRef);
    // Provided in current directive
    private _effectService: EffectService = inject(EffectService);

    private _borderLayer: HTMLElement | null = null;
    private _background: HTMLElement | null = null;

    public ngOnInit(): void {
        this.registerEffects();
    }

    private registerEffects(): void {
        this._effectService.registerEffect("AccentGradientBorderDirective.toggleBorder.on.accentGradientBorderChange", () => {
            const isEnabled = this.accentGradientBorder();

            if (!isEnabled) {
                this.cleanup();
                return;
            }

            this.setup();
        });
    }

    private setup(): void {
        if (this._borderLayer) {
            return;
        }

        const host = this._elementRef.nativeElement;

        this._renderer.setStyle(host, "position", "relative");

        this._borderLayer = this.createBorderLayer();
        this._background = this.createBackground();

        this._renderer.insertBefore(host, this._borderLayer, host.firstChild);
        this._renderer.insertBefore(host, this._background, host.firstChild);

        this.updateContentZIndex(host);
    }

    private cleanup(): void {
        if (!this._borderLayer) {
            return;
        }

        const host = this._elementRef.nativeElement;

        this._renderer.removeChild(host, this._borderLayer);
        this._borderLayer = null;

        if (this._background) {
            this._renderer.removeChild(host, this._background);
            this._background = null;
        }
    }

    private createBorderLayer(): HTMLElement {
        const maskValue = "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)";

        return createElement(this._renderer, "div", "accent-gradient-border__layer", {
            position: "absolute",
            top: "0",
            right: "0",
            bottom: "0",
            left: "0",
            "border-radius": "inherit",
            "pointer-events": "none",
            "z-index": "-1",
            background: "linear-gradient(90deg, var(--color-app-accent-color-1), var(--color-app-accent-color-2))",
            padding: "1px",
            mask: maskValue,
            "-webkit-mask": maskValue,
            "mask-composite": "exclude",
            "-webkit-mask-composite": "xor",
        });
    }

    private createBackground(): HTMLElement {
        return createElement(this._renderer, "div", "accent-gradient-border__background", {
            position: "absolute",
            top: "0",
            right: "0",
            bottom: "0",
            left: "0",
            "border-radius": "inherit",
            background: "var(--color-bg-default)",
            "z-index": "-1",
            "pointer-events": "none",
        });
    }

    private updateContentZIndex(host: HTMLElement): void {
        this._renderer.setStyle(host, "isolation", "isolate");

        Array.from(host.children).forEach((child: Element) => {
            if (child === this._borderLayer || child === this._background) {
                return;
            }
            applyStyles(this._renderer, child as HTMLElement, {
                position: "relative",
                "z-index": "1",
            });
        });
    }
}
