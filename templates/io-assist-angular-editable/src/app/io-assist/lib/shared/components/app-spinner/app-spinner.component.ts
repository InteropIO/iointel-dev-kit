import { CommonModule } from "@angular/common";
import { Component, input, InputSignal } from "@angular/core";

import { APP_SPINNER_COMPONENT_SIZE } from "./enum";
import { AppSpinnerComponentType } from "./types";

@Component({
    selector: "app-spinner",
    imports: [CommonModule],
    templateUrl: "./app-spinner.component.html",
})
export class AppSpinnerComponent {
    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;

    public size: InputSignal<AppSpinnerComponentType> = input<AppSpinnerComponentType>(APP_SPINNER_COMPONENT_SIZE.MEDIUM);
}
