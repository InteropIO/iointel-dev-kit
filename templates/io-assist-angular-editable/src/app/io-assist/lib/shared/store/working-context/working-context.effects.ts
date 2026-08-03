import { inject, Injectable } from "@angular/core";
import { IoIntelWorkingContext } from "@interopio/working-context";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { of, catchError, mergeMap, from, map } from "rxjs";

import {
    getWorkingContext,
    getWorkingContextFailure,
    getWorkingContextSuccess,
    fetchIsWorkingContextEnabledFailure,
    fetchIsWorkingContextEnabledSuccess,
    fetchIsWorkingContextEnabled,
} from "./working-context.actions";
import { WorkingContextService } from "../../services/working-context/working-context.service";

@Injectable()
export class WorkingContextEffects {
    private readonly _actions$: Actions = inject(Actions);
    private readonly _workingContextService: WorkingContextService = inject(WorkingContextService);

    getWorkingContext$ = createEffect(() =>
        this._actions$.pipe(
            ofType(getWorkingContext),
            mergeMap(() => {
                return from(this._workingContextService.getWorkingContext()).pipe(
                    map((workingContext: Record<string, IoIntelWorkingContext.Property>) => getWorkingContextSuccess({ workingContext })),
                    catchError((error) =>
                        of(
                            getWorkingContextFailure({
                                error: error instanceof Error ? error : new Error(String(error)),
                            })
                        )
                    )
                );
            })
        )
    );

    isWorkingContextEnabled$ = createEffect(() =>
        this._actions$.pipe(
            ofType(fetchIsWorkingContextEnabled),
            mergeMap(() => {
                return from(this._workingContextService.isWorkingContextEnabled()).pipe(
                    map((isEnabled: boolean) => fetchIsWorkingContextEnabledSuccess({ isEnabled })),
                    catchError((error) =>
                        of(
                            fetchIsWorkingContextEnabledFailure({
                                error: error instanceof Error ? error : new Error(String(error)),
                            })
                        )
                    )
                );
            })
        )
    );
}
