import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, input, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Subject, timer } from "rxjs";
import { switchMap } from "rxjs/operators";

import { UI_STRINGS } from "../../constants/ui-strings";
import { CopyToClipboardService } from "../../services/copy-to-clipboard/copy-to-clipboard.service";
import { AppIconComponent } from "../app-icon/app-icon.component";
import { APP_ICON_VARIANTS } from "../app-icon/enum";
import { AppTooltipComponent } from "../app-tooltip/app-tooltip.component";
import { TOOLTIP_DISPLAY_MODES, TOOLTIP_POSITIONS } from "../app-tooltip/enum";

const COPIED_DISPLAY_DURATION_MS = 2000;

@Component({
    selector: "app-copy-to-clipboard-button",
    imports: [CommonModule, AppIconComponent, AppTooltipComponent],
    templateUrl: "./app-copy-to-clipboard-button.component.html",
    providers: [CopyToClipboardService],
    host: {
        "(mouseenter)": "onMouseEnter()",
        "(mouseleave)": "onMouseLeave()",
    },
})
export class AppCopyToClipboardButtonComponent {
    public readonly textToCopy = input.required<string>();
    // eslint-disable-next-line @angular-eslint/no-input-rename -- alias is the kebab-case DOM attribute name, not a style choice
    public readonly dataTestId = input<string>("", { alias: "data-testid" });

    protected readonly UI_STRINGS = UI_STRINGS.GENERAL;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly TOOLTIP_POSITIONS = TOOLTIP_POSITIONS;
    protected readonly TOOLTIP_DISPLAY_MODES = TOOLTIP_DISPLAY_MODES;

    protected readonly isHoveredSignal: WritableSignal<boolean> = signal(false);
    protected readonly isCopiedSignal: WritableSignal<boolean> = signal(false);

    private readonly _copyToClipboardService: CopyToClipboardService = inject(CopyToClipboardService);

    // Each emission restarts the timer via switchMap, cancelling the previous one
    private readonly _copy$ = new Subject<void>();

    constructor() {
        this._copy$
            .pipe(
                switchMap(() => timer(COPIED_DISPLAY_DURATION_MS)),
                takeUntilDestroyed(inject(DestroyRef))
            )
            .subscribe(() => this.isCopiedSignal.set(false));
    }

    public handleCopyResponse(): void {
        this._copyToClipboardService.copyToClipboard(this.textToCopy());
        this.isCopiedSignal.set(true);
        this._copy$.next();
    }

    protected onMouseEnter(): void {
        this.isHoveredSignal.set(true);
    }

    protected onMouseLeave(): void {
        this.isHoveredSignal.set(false);
    }
}
