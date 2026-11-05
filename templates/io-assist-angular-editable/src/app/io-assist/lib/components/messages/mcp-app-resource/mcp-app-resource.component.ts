import { AfterViewInit, Component, ElementRef, input, InputSignal, OnChanges, OnDestroy, signal, Signal, viewChild, WritableSignal } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";

import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";

@Component({
    selector: "mcp-app-resource",
    imports: [AppIconComponent],
    template: `
        <div #outer class="mcp-app-outer" data-testid="mcp-app-outer">
            <div class="mcp-app-inner" [class.maximized]="isInline() && isMaximizedSignal()">
                @if (isInline()) {
                    <div class="mcp-app-header" data-testid="mcp-app-header">
                        <span class="mcp-app-title" data-testid="mcp-app-title">{{ appInstance()?.toolName }}</span>
                        <app-icon
                            class="mcp-app-header-icon"
                            [data-testid]="isMaximizedSignal() ? 'mcp-app-minimize-btn' : 'mcp-app-maximize-btn'"
                            [variant]="isMaximizedSignal() ? APP_ICON_VARIANTS.MINIMIZE : APP_ICON_VARIANTS.MAXIMIZE"
                            [size]="APP_ICON_SIZES.S"
                            [hoverBackgroundColor]="'app-icon-background-hover'"
                            [title]="isMaximizedSignal() ? 'Restore' : 'Maximize'"
                            (onClick)="onToggleClick()"
                        ></app-icon>
                    </div>
                }

                <div #container class="mcp-app-container" data-testid="mcp-app-container"></div>
            </div>
        </div>
    `,
    styles: [
        `
            :host {
                position: relative;
                width: 100%;
                display: block;
            }

            .mcp-app-outer {
                position: relative;
                width: 100%;
            }

            .mcp-app-inner {
                width: 100%;
            }

            .mcp-app-inner.maximized {
                position: fixed;
                inset: 0;
                z-index: 1000;
                background: var(--app-background-primary, #fff);
            }

            .mcp-app-inner.maximized .mcp-app-header {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1;
            }

            .mcp-app-inner.maximized .mcp-app-container {
                position: absolute;
                inset: 0;
                overflow: auto;
            }

            .mcp-app-inner.maximized .mcp-app-container ::ng-deep * {
                height: 100% !important;
            }

            .mcp-app-container {
                width: 100%;
                position: relative;
            }

            .mcp-app-header {
                position: relative;
                width: 100%;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 6px 6px 6px 12px;
                font-size: 12px;
                font-weight: 600;
                color: var(--app-text-states-active, #333);
                background: var(--app-background-secondary, #f5f5f5);
                border-top: 2px solid var(--app-accent-color-1, #f58220);
                border-bottom: 1px solid var(--app-border-default, #e0e0e0);
            }

            .mcp-app-title {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: inherit;
            }

            .mcp-app-header-icon {
                flex: none;
            }
        `,
    ],
})
export class McpAppResourceComponent implements OnChanges, AfterViewInit, OnDestroy {
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;

    /** The live AppInstance returned by ai-web. Pass null/undefined when not yet available. */
    public readonly appInstance: InputSignal<IoAiWeb.McpApps.AppInstance | undefined> = input<IoAiWeb.McpApps.AppInstance | undefined>(undefined);

    protected readonly isMaximizedSignal: WritableSignal<boolean> = signal(false);

    private readonly _outerRef: Signal<ElementRef | undefined> = viewChild<ElementRef>("outer");
    private readonly _containerRef: Signal<ElementRef | undefined> = viewChild<ElementRef>("container");

    private _mountedInstanceId: string | null = null;
    private _elementAppended = false;
    private _unsubscribeDisplayModeChange: IoAiWeb.Unsubscribe | null = null;


    public ngOnChanges(): void {
        this._trackInstance(this.appInstance());
        this._appendElement(this.appInstance());
    }

    public ngAfterViewInit(): void {
        // viewChild signals are resolved after view init — retry appending the element
        // in case ngOnChanges fired first (before the container ref was available).
        this._appendElement(this.appInstance());
    }

    public ngOnDestroy(): void {
        this._cleanup();
    }

    protected isInline(): boolean {
        return this.appInstance()?.displayMode === "inline";
    }

    protected onMaximizeClick(): void {
        this.appInstance()?.maximize();
    }

    protected onMinimizeClick(): void {
        this.appInstance()?.minimize();
    }

    protected onToggleClick(): void {
        if (this.isMaximizedSignal()) {
            this.onMinimizeClick();
            return;
        }

        this.onMaximizeClick();
    }

    /**
     * Tracks the current instance ID so we can detect when the input changes.
     * The chat-message subscription is managed at the service level (IOIntelWebService),
     * not here, so this only guards against redundant element appends.
     */
    private _trackInstance(instance: IoAiWeb.McpApps.AppInstance | undefined): void {
        if (!instance) return;
        if (this._mountedInstanceId === instance.id) return;
        this._cleanup();
        this._mountedInstanceId = instance.id;
        this.isMaximizedSignal.set(instance.isMaximized);
        this._unsubscribeDisplayModeChange = instance.onDisplayModeChange((mode) => {
            const outer = this._outerRef()?.nativeElement as HTMLElement | undefined;

            // Pin the outer wrapper's height to its current (pre-maximize) size before the
            // inner content switches to `position: fixed` (and is removed from flow), so the
            // chat scroll area's total height/scroll position never changes across the toggle.
            if (mode === "fullscreen" && outer) {
                outer.style.height = `${outer.offsetHeight}px`;
            }

            this.isMaximizedSignal.set(mode === "fullscreen");

            if (mode === "inline" && outer) {
                outer.style.height = "";
            }
        });
    }

    /**
     * Appends the instance's proxy element into the container div.
     * Safe to call multiple times — only appends once per instance.
     */
    private _appendElement(instance: IoAiWeb.McpApps.AppInstance | undefined): void {
        if (!instance?.element) return;
        if (this._elementAppended) return;

        const container = this._containerRef()?.nativeElement as HTMLElement | undefined;
        if (!container) return;

        container.appendChild(instance.element);
        this._elementAppended = true;
    }

    private _cleanup(): void {
        const container = this._containerRef()?.nativeElement as HTMLElement | undefined;
        const outer = this._outerRef()?.nativeElement as HTMLElement | undefined;

        if (container) {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        }

        if (outer) {
            outer.style.height = "";
        }

        this._unsubscribeDisplayModeChange?.();
        this._unsubscribeDisplayModeChange = null;
        this._mountedInstanceId = null;
        this._elementAppended = false;
        this.isMaximizedSignal.set(false);
    }
}


