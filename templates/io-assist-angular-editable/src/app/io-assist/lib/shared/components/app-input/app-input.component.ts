import { CommonModule } from "@angular/common";
import { Component, input, InputSignal, output, OutputEmitterRef, signal, WritableSignal } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { UI_STRINGS } from "../../constants/ui-strings";
import { AppIconComponent } from "../app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../app-icon/enum";

enum INPUT_TYPES_ENUM {
    TEXT = "text",
    PASSWORD = "password",
    EMAIL = "email",
    NUMBER = "number",
    SEARCH = "search",
    TEL = "tel",
    URL = "url",
}

type AppInputType = INPUT_TYPES_ENUM[keyof INPUT_TYPES_ENUM];

const MODULES = [FormsModule, CommonModule];
const COMPONENTS = [AppIconComponent];

/**
 * A reusable input component with various customization options.
 * Behaves like a standard HTML input element.
 *
 * Inputs:
 * @type {InputSignal<string>} placeholder - Placeholder text for the input field.
 * @type {InputSignal<AppInputType>} type - Type of the input field (e.g., text, password).
 * @type {InputSignal<string>} label - Label text for the input field.
 * @type {InputSignal<boolean>} isLabelSrOnly - Whether the label is only for screen readers.
 * @type {InputSignal<boolean>} disabled - Whether the input field is disabled.
 * @type {InputSignal<string>} error - Error message to display below the input field.
 * @type {InputSignal<boolean>} showLeadingIcon - Whether to show a leading icon.
 * @type {InputSignal<APP_ICON_VARIANTS>} leadingIconVariant - Variant of the leading icon.
 * @type {InputSignal<boolean>} showTrailingIcon - Whether to show a trailing icon.
 * @type {InputSignal<APP_ICON_VARIANTS>} trailingIconVariant - Variant of the trailing icon.
 * @type {InputSignal<APP_ICON_SIZES>} iconsSize - Size of the icons.
 *
 * Outputs:
 * @type {OutputEmitterRef<string>} onValueChange - Emits the current value of the input field on change.
 */
@Component({
    selector: "app-input",
    imports: [...MODULES, ...COMPONENTS],
    templateUrl: "./app-input.component.html",
})
export class AppInputComponent {
    protected readonly APP_INPUT_COMPONENT_STRINGS = UI_STRINGS.INPUT_COMPONENT;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;

    public readonly placeholder: InputSignal<string> = input<string>(this.APP_INPUT_COMPONENT_STRINGS.DEFAULT_PLACEHOLDER);
    public readonly type: InputSignal<AppInputType> = input<AppInputType>(INPUT_TYPES_ENUM.TEXT);
    public readonly label: InputSignal<string> = input<string>("");
    public readonly isLabelSrOnly: InputSignal<boolean> = input<boolean>(false);
    public readonly disabled: InputSignal<boolean> = input<boolean>(false);
    public readonly error: InputSignal<string> = input<string>("");
    public readonly showLeadingIcon: InputSignal<boolean> = input<boolean>(false);
    public readonly leadingIconVariant: InputSignal<APP_ICON_VARIANTS> = input<APP_ICON_VARIANTS>(APP_ICON_VARIANTS.SEARCH);
    public readonly showTrailingIcon: InputSignal<boolean> = input<boolean>(false);
    public readonly trailingIconVariant: InputSignal<APP_ICON_VARIANTS> = input<APP_ICON_VARIANTS>(APP_ICON_VARIANTS.CLOSE);
    public readonly iconsSize: InputSignal<APP_ICON_SIZES> = input<APP_ICON_SIZES>(APP_ICON_SIZES.XS);

    public onValueChange: OutputEmitterRef<string> = output<string>();

    protected isActive: WritableSignal<boolean> = signal<boolean>(false);
    protected value: WritableSignal<string> = signal<string>("");

    protected onInput(event: Event): void {
        const target: HTMLInputElement = event.target as HTMLInputElement;

        this.value.set(target.value);
        this.onValueChange.emit(target.value);
    }

    protected clearContent(): void {
        this.value.set("");

        this.onValueChange.emit("");
    }
}
