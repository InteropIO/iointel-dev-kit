import { OverlayRef } from "@angular/cdk/overlay";
import { ComponentRef } from "@angular/core";

import { AppPanelComponent } from "../../components/app-panel/app-panel.component";

export type PanelOverlayResult<T = unknown> = {
    overlayRef: OverlayRef;
    panelRef: ComponentRef<AppPanelComponent>;
    contentRef?: ComponentRef<T>;
};
