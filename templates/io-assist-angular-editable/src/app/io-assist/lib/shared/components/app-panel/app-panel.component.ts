import { CommonModule } from "@angular/common";
import { Component, ComponentRef, input, InputSignal, output, OutputEmitterRef, Type, ViewChild, ViewContainerRef } from "@angular/core";

import { PANEL_BUTTON_ACTION_TYPE } from "./enums";
import { AppPanelActionType, AppPanelFooterButton } from "./types";
import { UI_STRINGS } from "../../constants/ui-strings";
import { AppButtonComponent } from "../app-button/app-button.component";
import { AppIconComponent } from "../app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../app-icon/enum";

const MODULES = [CommonModule];
const COMPONENTS = [AppButtonComponent, AppIconComponent];

/**
 * This is a reusable app panel component. It can displayed in two ways:
 * 1. As a standalone component in a template with ngIf to control its visibility
 * 2. As an overlay using the OverlayService to manage its display and state
 */
@Component({
    selector: "app-panel",
    templateUrl: "./app-panel.component.html",
    imports: [...MODULES, ...COMPONENTS],
})
export class AppPanelComponent {
    protected readonly UI_STRINGS = UI_STRINGS.PANEL_COMPONENT;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;

    @ViewChild("panelBodyContent", { read: ViewContainerRef, static: false })
    public panelBodyContent!: ViewContainerRef;

    public isHeaderCloseButtonDisplayed: InputSignal<boolean> = input<boolean>(false);
    public title: InputSignal<string | undefined> = input<string | undefined>(this.UI_STRINGS.DEFAULT_TITLE);
    public description: InputSignal<string | undefined> = input<string | undefined>(undefined);
    public htmlContent: InputSignal<string | undefined> = input<string | undefined>(undefined);
    public footerButtons: InputSignal<AppPanelFooterButton[]> = input<AppPanelFooterButton[]>([]);

    public onClose: OutputEmitterRef<void> = output<void>();
    public onSubmit: OutputEmitterRef<AppPanelActionType> = output<AppPanelActionType>();

    protected handleButtonClick(button: AppPanelFooterButton): void {
        switch (button.action) {
            case PANEL_BUTTON_ACTION_TYPE.CLOSE:
                this.onClose.emit();
                break;
            case PANEL_BUTTON_ACTION_TYPE.SUBMIT:
                this.onSubmit.emit(PANEL_BUTTON_ACTION_TYPE.SUBMIT);
                break;
            case PANEL_BUTTON_ACTION_TYPE.CUSTOM:
                if (!button.onClick) {
                    throw new Error("Custom action button must have an onClick handler defined");
                }

                button.onClick();

                break;
            default:
                break;
        }
    }

    public injectBodyContent<T>(component: Type<T>): ComponentRef<T> {
        const container: ViewContainerRef | undefined = this.panelBodyContent;

        if (!container) throw new Error("Panel body content container is not defined");

        container.clear();
        return container.createComponent(component);
    }
}
