import { AfterViewInit, Component, ElementRef, input, InputSignal, OnChanges, OnDestroy, viewChild, Signal } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";

@Component({
    selector: "mcp-app-resource",
    template: `<div #container class="mcp-app-container"></div>`,
    styles: [
        `
            .mcp-app-container {
                width: 100%;
            }
        `,
    ],
})
export class McpAppResourceComponent implements OnChanges, AfterViewInit, OnDestroy {
    /** The live AppInstance returned by ai-web. Pass null/undefined when not yet available. */
    public readonly appInstance: InputSignal<IoAiWeb.McpApps.AppInstance | undefined> = input<IoAiWeb.McpApps.AppInstance | undefined>(undefined);

    private readonly _containerRef: Signal<ElementRef | undefined> = viewChild<ElementRef>("container");

    private _mountedInstanceId: string | null = null;
    private _elementAppended = false;

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
        if (container) {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        }
        this._mountedInstanceId = null;
        this._elementAppended = false;
    }
}
