import { inject, Injectable, Signal } from "@angular/core";
import { Store } from "@ngrx/store";

import { changeActiveThread, deleteThread, fetchThreads, renameThread } from "./thread.actions";
import { selectActiveThread, selectActiveThreadId, selectAllThreads, selectIsFetchingThreads, selectThreadLength, selectThreadLoadingState } from "./thread.selector";
import { UIThread } from "./types";
import { LoadingType } from "../../types/loading.type";

@Injectable({
    providedIn: "root",
})
export class ThreadFacade {
    private readonly _store: Store = inject(Store);

    private readonly _allThreads: Signal<UIThread[]> = this._store.selectSignal<UIThread[]>(selectAllThreads);
    public get allThreads(): Signal<UIThread[]> {
        return this._allThreads;
    }

    private readonly _threadLength: Signal<number> = this._store.selectSignal<number>(selectThreadLength);
    public get threadLength(): Signal<number> {
        return this._threadLength;
    }

    private readonly _threadLoadingState: Signal<LoadingType> = this._store.selectSignal<LoadingType>(selectThreadLoadingState);
    public get threadLoadingState(): Signal<LoadingType> {
        return this._threadLoadingState;
    }

    private readonly _isFetchingThreads: Signal<boolean> = this._store.selectSignal<boolean>(selectIsFetchingThreads);
    public get isFetchingThreads(): Signal<boolean> {
        return this._isFetchingThreads;
    }

    private readonly _activeThreadId: Signal<string | null> = this._store.selectSignal<string | null>(selectActiveThreadId);
    public get activeThreadId(): Signal<string | null> {
        return this._activeThreadId;
    }

    private readonly _activeThread: Signal<UIThread | null> = this._store.selectSignal<UIThread | null>(selectActiveThread);
    public get activeThread(): Signal<UIThread | null> {
        return this._activeThread;
    }

    public dispatchFetchThreads(agentId: string): void {
        this._store.dispatch(fetchThreads({ agentId }));
    }

    public dispatchRenameThread(thread: UIThread, newTitle: string): void {
        this._store.dispatch(renameThread({ thread, newTitle }));
    }

    public dispatchDeleteThread(thread: UIThread): void {
        this._store.dispatch(deleteThread({ thread }));
    }

    public dispatchChangeActiveThread(threadId: string | null): void {
        this._store.dispatch(changeActiveThread({ threadId }));
    }
}
