import { CommonModule } from "@angular/common";
import { Component, computed, inject, Signal } from "@angular/core";

import { APP_BUTTON_TYPES } from "../../../shared/components/app-button/enum";
import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { PermissionRequestService, PermissionRequestState } from "../../../shared/services/permission-request/permission-request.service";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent];

@Component({
    selector: "permission-request-card",
    templateUrl: "./permission-request-card.component.html",
    imports: [...MODULES, ...COMPONENTS],
    host: { "data-testid": "permission-request-card-host" },
})
export class PermissionRequestCardComponent {
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;
    protected readonly APP_BUTTON_TYPES = APP_BUTTON_TYPES;

    private readonly _permissionRequestService: PermissionRequestService = inject(PermissionRequestService);
    protected readonly request: Signal<PermissionRequestState | null> = this._permissionRequestService.current;

    protected readonly text: Signal<string> = computed<string>(() => {
        const description = this.request()?.description?.trim() ?? "";

        return description.endsWith("?") ? description : `${description} ${UI_STRINGS.PERMISSION_REQUEST_CARD_COMPONENT.PROCEED_QUESTION}`.trim();
    });

    protected respond(id: string): void {
        this._permissionRequestService.respond(id);
    }
}
