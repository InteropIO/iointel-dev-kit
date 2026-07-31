import { CommonModule } from "@angular/common";
import { Component, input, InputSignal, output, OutputEmitterRef } from "@angular/core";

import { APP_BUTTON_TYPES } from "./enum";
import { AppButtonType } from "./types";

@Component({
    selector: "app-button",
    imports: [CommonModule],
    templateUrl: "./app-button.component.html",
    /**
     * Display it like this so that it doesn't create a new DOM element and break the layout of the parent component.
     */
    host: { style: "display: contents" },
})
export class AppButtonComponent {
    protected readonly APP_BUTTON_TYPES = APP_BUTTON_TYPES;

    public buttonType: InputSignal<AppButtonType> = input<AppButtonType>(APP_BUTTON_TYPES.DEFAULT);
    public disabled: InputSignal<boolean> = input<boolean>(false);
    public testId: InputSignal<string | null> = input<string | null>(null);
    public onClick: OutputEmitterRef<void> = output<void>();
}
