import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import { ComponentRef, EnvironmentInjector, inject, Injectable, signal, Type, WritableSignal } from "@angular/core";

import { PanelOverlayResult } from "./types";
import { AppPanelComponent } from "../../components/app-panel/app-panel.component";
import { AppPanelOverlayConfig } from "../../components/app-panel/types";

/**
 * Service to manage overlay states such as:
 *     - displaying or hiding the thread history UI
 *     - other overlay states can be added here in the future
 *
 * TODO: Extract state in a root store when state grows beyond this simple use case
 */
@Injectable({
    providedIn: "root",
})
export class OverlayService {
    public isThreadHistoryDisplayed: WritableSignal<boolean> = signal(false);
    public isPromptPanelDisplayed: WritableSignal<boolean> = signal(false);
    public isToolPanelDisplayed: WritableSignal<boolean> = signal(false);

    private _overlayStack: OverlayRef[] = [];
    private _overlaySignals = new Map<OverlayRef, WritableSignal<boolean>>();

    private _overlayCDK = inject(Overlay);
    private _injector = inject(EnvironmentInjector);

    public showPanelOverlay<T = unknown>(config?: AppPanelOverlayConfig): PanelOverlayResult<T> {
        if (!config) throw new Error("Overlay config is required to display the panel overlay");

        if (!config.content) {
            throw new Error("Overlay config must include content to display in the panel");
        }

        const overlayRef: OverlayRef = this._overlayCDK.create({
            hasBackdrop: true,
            backdropClass: "cdk-overlay-dark-backdrop",
            panelClass: "panel-overlay-container",
            positionStrategy: this._overlayCDK.position().global().centerHorizontally().centerVertically(),
        });

        const portal: ComponentPortal<AppPanelComponent> = new ComponentPortal<AppPanelComponent>(AppPanelComponent, null, this._injector);

        const panelRef: ComponentRef<AppPanelComponent> = overlayRef.attach(portal);

        panelRef.setInput("title", config.title ?? "");
        panelRef.setInput("description", config.description ?? "");
        panelRef.setInput("footerButtons", config.footerButtons ?? []);
        panelRef.setInput("isHeaderCloseButtonDisplayed", config.isHeaderCloseButtonDisplayed ?? true);

        // Handle HTML content if provided as string
        if (config.content && typeof config.content === "string") {
            panelRef.setInput("htmlContent", config.content);
        }

        panelRef.instance.onClose.subscribe(() => {
            this._removeOverlayFromStack(overlayRef);
            overlayRef.dispose();

            this._overlaySignals.get(overlayRef)?.set(false);
            this._overlaySignals.delete(overlayRef);
        });

        // Use this to handle on submit events from the panel if needed in the future
        //panelRef.instance.onSubmit.subscribe((action) => {});

        const result: PanelOverlayResult<T> = {
            overlayRef,
            panelRef,
            contentRef: undefined,
        };

        // Add overlay to stack
        this._overlayStack.push(overlayRef);

        // Handle backdrop clicks - only close the top-most overlay
        overlayRef.backdropClick().subscribe(() => {
            if (this._overlayStack[this._overlayStack.length - 1] === overlayRef) {
                this._removeOverlayFromStack(overlayRef);
                overlayRef.dispose();

                this._overlaySignals.get(overlayRef)?.set(false);
                this._overlaySignals.delete(overlayRef);
            }
        });

        // Inject component content after the current change detection cycle (if content is a component)
        if (config.content && typeof config.content !== "string") {
            setTimeout(() => {
                result.contentRef = panelRef.instance.injectBodyContent(config.content as Type<unknown>) as ComponentRef<T>;
            }, 0);
        }

        if (config.isDisplayedSignal) {
            this._overlaySignals.set(overlayRef, config.isDisplayedSignal);
            config.isDisplayedSignal.set(true);
        }

        return result;
    }

    public closeCurrentOverlay(): void {
        const topOverlay: OverlayRef = this._overlayStack[this._overlayStack.length - 1];

        if (!topOverlay) return;

        this._removeOverlayFromStack(topOverlay);
        topOverlay.dispose();

        this._overlaySignals.get(topOverlay)?.set(false);
        this._overlaySignals.delete(topOverlay);
    }

    private _removeOverlayFromStack(overlayRef: OverlayRef): void {
        const index: number = this._overlayStack.indexOf(overlayRef);

        if (index > -1) {
            this._overlayStack.splice(index, 1);
        }
    }
}
