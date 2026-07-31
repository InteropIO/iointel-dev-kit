import { Type, WritableSignal } from "@angular/core";

import { PANEL_BUTTON_ACTION_TYPE } from "./enums";
import { AppButtonType } from "../app-button/types";

/**
 * Configuration options for displaying the AppPanelComponent as an overlay.
 * All fields are optional to allow for flexible panel configurations.
 * @title The title text displayed at the top of the panel.
 * @description Optional description text displayed below the title.
 * @content The component type to be injected into the panel body OR an HTML string to be rendered.
 * @footerButtons An array of button configurations for the panel footer.
 * @isHeaderCloseButtonDisplayed A boolean indicating whether to show a close button in the header.
 * @isDisplayedSignal An optional WritableSignal that the service will set to `true` when the panel is opened and `false` when it is closed (via the header close button or a backdrop click). The caller is responsible for creating the signal; the service only calls `.set()` on it.
 */
export type AppPanelOverlayConfig = {
    title?: string;
    description?: string;
    content?: Type<unknown> | string;
    footerButtons?: AppPanelFooterButton[];
    isHeaderCloseButtonDisplayed?: boolean;
    isDisplayedSignal?: WritableSignal<boolean>;
};

export type AppPanelActionType = PANEL_BUTTON_ACTION_TYPE.CLOSE | PANEL_BUTTON_ACTION_TYPE.SUBMIT | PANEL_BUTTON_ACTION_TYPE.CUSTOM;

export type AppPanelFooterButton = {
    label: string;
    action: AppPanelActionType;
    type: AppButtonType;
    onClick?: () => void;
    testId?: string;
};
