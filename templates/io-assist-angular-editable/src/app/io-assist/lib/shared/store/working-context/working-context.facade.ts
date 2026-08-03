import { inject, Injectable, Signal } from "@angular/core";
import { IoIntelWorkingContext } from "@interopio/working-context";
import { Store } from "@ngrx/store";

import { fetchIsWorkingContextEnabled, getWorkingContext, updateWorkingContext } from "./working-context.actions";
import { isWorkingContextEnabled, selectWorkingContext } from "./working-context.selector";

@Injectable()
export class WorkingContextFacade {
    private readonly _store: Store = inject(Store);

    private readonly _workingContext: Signal<Record<string, IoIntelWorkingContext.Property>> = this._store.selectSignal<Record<string, IoIntelWorkingContext.Property>>(selectWorkingContext);
    public get workingContext(): Signal<Record<string, IoIntelWorkingContext.Property>> {
        return this._workingContext;
    }

    private readonly _isWorkingContextEnabled: Signal<boolean> = this._store.selectSignal<boolean>(isWorkingContextEnabled);
    public get isWorkingContextEnabled(): Signal<boolean> {
        return this._isWorkingContextEnabled;
    }

    public dispatchGetWorkingContext(): void {
        this._store.dispatch(getWorkingContext());
    }

    public dispatchUpdateWorkingContext(workingContext: Record<string, IoIntelWorkingContext.Property>): void {
        this._store.dispatch(updateWorkingContext({ workingContext }));
    }

    public dispatchFetchIsWorkingContextEnabled(): void {
        this._store.dispatch(fetchIsWorkingContextEnabled());
    }
}
