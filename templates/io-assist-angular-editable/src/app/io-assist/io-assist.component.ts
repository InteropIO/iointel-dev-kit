import { CommonModule } from "@angular/common";
import { Component, computed, inject, input, OnInit, Signal } from "@angular/core";

import { ChatComponent } from "./components/chat/chat.component";
import { IO_ASSIST_DYNAMIC_CONFIG, IoAssistDynamicConfig } from "./io-assist.config";
import { IoAssistDynamicConfigSchema } from "./io-assist.schema";
import { AppSpinnerComponent } from "./shared/components/app-spinner/app-spinner.component";
import { APP_SPINNER_COMPONENT_SIZE } from "./shared/components/app-spinner/enum";
import { UI_STRINGS } from "./shared/constants/ui-strings";
import { ComponentEffectManagerService as EffectService } from "./shared/services/component-effect-manager/component-effect-manager.service";
import { IOConnectService } from "./shared/services/io/io.service";
import { AppLifecycleFacade } from "./shared/store/app-lifecycle/app-lifecycle.facade";

const COMPONENTS = [AppSpinnerComponent, ChatComponent];
const MODULES = [CommonModule];

@Component({
    selector: "io-assist",
    imports: [...COMPONENTS, ...MODULES],
    templateUrl: "./io-assist.component.html",
    providers: [
        {
            provide: EffectService,
            useFactory: () => new EffectService("IoAssist"),
        },
    ],
})
export class IoAssist implements OnInit {
    protected readonly UI_STRINGS = UI_STRINGS.GENERAL;
    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;

    // Dynamic config input — passed by the consumer after login.
    // Synced into IO_ASSIST_DYNAMIC_CONFIG so root-level services can read it.
    private readonly _dynamicConfigToken = inject(IO_ASSIST_DYNAMIC_CONFIG);
    readonly config = input.required<IoAssistDynamicConfig>();

    // Provided in root
    private readonly _ioService: IOConnectService = inject(IOConnectService);

    // Provided in current component
    private readonly _effectService: EffectService = inject(EffectService);

    private readonly _appLifecycleFacade: AppLifecycleFacade = inject(AppLifecycleFacade);

    protected readonly isIoReady: Signal<boolean> = this._ioService.isIoConnectReady;
    protected readonly isAppCoreServicesStarted: Signal<boolean> = this._appLifecycleFacade.isAppCoreServicesStarted;
    protected readonly appCoreServicesError: Signal<string | null> = this._appLifecycleFacade.appCoreServicesErrorMessage;
    protected readonly isAppCoreServicesError: Signal<boolean> = computed(() => this._appLifecycleFacade.appCoreServicesErrorMessage() !== null);
    protected readonly isAppCoreServicesPending: Signal<boolean> = this._appLifecycleFacade.isPendingAppCoreServicesOperation;

    public ngOnInit(): void {
        const parsedConfig = IoAssistDynamicConfigSchema.parse(this.config());

        this._dynamicConfigToken.set(parsedConfig);

        this.registerEffects();
    }

    protected refreshPage(): void {
        window.location.reload();
    }

    private registerEffects(): void {
        this._effectService.registerEffect("IoAssist.subscribeToThemeChanges", () => this.isIoReady() && this._ioService.startIODependentTasks());
    }
}
