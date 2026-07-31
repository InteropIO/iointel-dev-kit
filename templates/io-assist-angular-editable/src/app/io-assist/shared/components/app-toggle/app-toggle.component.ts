import { CommonModule } from "@angular/common";
import { Component, input, InputSignal, output, OutputEmitterRef } from "@angular/core";

import { AppIconComponent } from "../app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../app-icon/enum";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent];

/**
 * AppToggleComponent
 *
 * A reusable toggle switch component that provides a visual on/off state indicator.
 * The component supports disabled state and emits events when toggled.
 *
 * @example
 * ```html
 * <app-toggle
 *   [isChecked]="isChecked"
 *   [isDisabled]="isDisabled"
 *   (onToggle)="handleToggle($event)">
 * </app-toggle>
 * ```
 *
 * @input {boolean} isChecked - Determines if the toggle is in the checked (on) state. Default: false
 * @input {boolean} isDisabled - Determines if the toggle is disabled and cannot be interacted with. Default: false
 *
 * @output {boolean} onToggle - Emits the new checked state when the toggle is clicked
 */
@Component({
    selector: "app-toggle",
    imports: [...MODULES, ...COMPONENTS],
    templateUrl: "./app-toggle.component.html",
})
export class AppToggleComponent {
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;

    public readonly isChecked: InputSignal<boolean> = input<boolean>(false);
    public readonly isDisabled: InputSignal<boolean> = input<boolean>(false);

    public readonly onToggle: OutputEmitterRef<boolean> = output<boolean>();

    protected handleToggle(): void {
        if (!this.isDisabled()) {
            this.onToggle.emit(!this.isChecked());
        }
    }

    protected handleKeyDown(event: KeyboardEvent): void {
        if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            this.handleToggle();
        }
    }
}
