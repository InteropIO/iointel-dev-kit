import { CommonModule } from "@angular/common";
import { Component, computed, inject, Signal } from "@angular/core";

import { IO_ASSIST_DYNAMIC_CONFIG, IoAssistDynamicConfig } from "../../../io-assist.config";
import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { APP_SPINNER_COMPONENT_SIZE } from "../../../shared/components/app-spinner/enum";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { IOConnectService } from "../../../shared/services/io/io.service";
import { OverlayService } from "../../../shared/services/overlay/overlay.service";
import { ThreadFacade } from "../../../shared/store/thread/thread.facade";
import { ThreadHistoryListComponent } from "../thread-history-list/thread-history-list.component";

@Component({
    selector: "thread-history",
    templateUrl: "./thread-history.component.html",
    imports: [CommonModule, ThreadHistoryListComponent, AppIconComponent],
})
export class ThreadHistoryComponent {
    protected readonly UI_STRINGS = UI_STRINGS.GENERAL;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;
    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;

    // Provided in root
    private readonly _overlayService: OverlayService = inject(OverlayService);
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);
    private readonly _ioConnectService: IOConnectService = inject(IOConnectService);
    private readonly _dynamicConfig: Signal<IoAssistDynamicConfig> = inject(IO_ASSIST_DYNAMIC_CONFIG);

    protected readonly threadsLength: Signal<number> = this._threadFacade.threadLength;
    protected readonly isDarkMode: Signal<boolean> = this._ioConnectService.isDarkMode;
    protected readonly username = computed(() => this._dynamicConfig().user.name);

    protected readonly hasUsername = computed(() => !!this._dynamicConfig().user.name);

    protected readonly userInitial = computed(() => {
        const name = this._dynamicConfig().user.name;
        return name ? name.charAt(0).toUpperCase() : "U";
    });

    protected hideThreadHistory(): void {
        this._overlayService.isThreadHistoryDisplayed.set(false);
    }
}
