import { inject, Injectable, Signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { from, merge, of, catchError, filter, map, switchMap, take } from "rxjs";

import { initialAppCoreServicesInit, initialAppCoreServicesInitFailure, initialAppCoreServicesInitSuccess } from "./app-lifecycle.actions";
import { IOAiWebService } from "../../services/io-ai-web/io-ai-web.service";
import { AgentFacade } from "../agent/agent.facade";
import { PromptFacade } from "../prompt/prompt.facade";

@Injectable()
export class AppLifecycleEffects {
    private readonly _actions$: Actions = inject(Actions);
    private readonly _store: Store = inject(Store);

    private readonly _ioIntelWebService: IOAiWebService = inject(IOAiWebService);

    private readonly _agentFacade: AgentFacade = inject(AgentFacade);
    private readonly _promptFacade: PromptFacade = inject(PromptFacade);

    private readonly _isIoIntelWebAvailable: Signal<boolean> = this._ioIntelWebService.isInitialized;
    private readonly _isIoIntelWebInitializing: Signal<boolean> = this._ioIntelWebService.isInitializing;
    private readonly _ioIntelWebInitializeError: Signal<string> = this._ioIntelWebService.isError;

    private readonly _initialized$ = toObservable(this._isIoIntelWebAvailable);
    private readonly _error$ = toObservable(this._ioIntelWebInitializeError);

    watchIoIntelWebInit$ = createEffect(() =>
        merge(
            this._error$.pipe(
                filter(Boolean),
                map((msg) => initialAppCoreServicesInitFailure({ error: new Error(msg) }))
            ),
            this._initialized$.pipe(
                filter(Boolean),
                map(() => initialAppCoreServicesInitSuccess())
            )
        ).pipe(take(1))
    );

    initialAppCoreServicesInit$ = createEffect(() =>
        this._actions$.pipe(
            ofType(initialAppCoreServicesInit),
            switchMap(() => {
                if (this._isIoIntelWebAvailable()) {
                    return of(initialAppCoreServicesInitSuccess());
                }

                if (this._isIoIntelWebInitializing()) {
                    // Already initializing — watchIoIntelWebInit$ will dispatch
                    // success/failure when the state changes.
                    return [];
                }

                return from(this._ioIntelWebService.initialize()).pipe(
                    // No action dispatched here, wait for initialization effect
                    switchMap(() => []),
                    // Swallow the error — watchIoIntelWebInit$ dispatches
                    // the failure and we do not want double dispatch
                    catchError(() => [])
                );
            })
        )
    );

    initialAppCoreServicesInitSuccess$ = createEffect(
        () =>
            this._actions$.pipe(
                ofType(initialAppCoreServicesInitSuccess),
                map(() => {
                    // Dispatch actions needed after initialized IoAiWeb API
                    this._agentFacade.dispatchListAvailableAgents();
                    this._promptFacade.dispatchParsePromptsConfig();
                    // this._xxxFacade.dispatchListXXX();
                })
            ),
        { dispatch: false }
    );
}
