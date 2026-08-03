import { computed, inject, Injectable, Signal } from "@angular/core";
import { Store } from "@ngrx/store";

import { initialAppCoreServicesInit } from "./app-lifecycle.actions";
import { selectAppCoreServicesLoadingState, selectIsAppCoreServicesStarted, selectIsPendingState } from "./app-lifecycle.selector";
import { LOADING_STATE } from "../../enums/loading-state.enum";
import { LoadingType } from "../../types/loading.type";

@Injectable({
    providedIn: "root",
})
export class AppLifecycleFacade {
    private readonly store: Store = inject(Store);

    private readonly _isAppCoreServicesStarted: Signal<boolean> = this.store.selectSignal<boolean>(selectIsAppCoreServicesStarted);
    public get isAppCoreServicesStarted(): Signal<boolean> {
        return this._isAppCoreServicesStarted;
    }

    private readonly _appCoreServicesLoadingState: Signal<LoadingType> = this.store.selectSignal<LoadingType>(selectAppCoreServicesLoadingState);
    public get appCoreServicesLoadingState(): Signal<LoadingType> {
        return this._appCoreServicesLoadingState;
    }

    private readonly _isPendingAppCoreServicesOperation: Signal<boolean> = this.store.selectSignal<boolean>(selectIsPendingState);
    public get isPendingAppCoreServicesOperation(): Signal<boolean> {
        return this._isPendingAppCoreServicesOperation;
    }

    private readonly _appCoreServicesErrorMessage: Signal<string | null> = computed(() => {
        const loadingState: LoadingType = this._appCoreServicesLoadingState();

        return loadingState.type === LOADING_STATE.ERROR ? loadingState.message : null;
    });

    public get appCoreServicesErrorMessage(): Signal<string | null> {
        return this._appCoreServicesErrorMessage;
    }

    public dispatchInitAppCoreServices(): void {
        return this.store.dispatch(initialAppCoreServicesInit());
    }
}
