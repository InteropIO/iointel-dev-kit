import { inject, Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { mergeMap, from, of, map, catchError, switchMap, EMPTY } from "rxjs";

import {
    renameThread,
    renameThreadSuccess,
    renameThreadFailure,
    fetchThreads,
    fetchThreadsSuccess,
    deleteThread,
    deleteThreadSuccess,
    deleteThreadFailure,
    fetchThreadsFailure,
    changeActiveThread,
} from "./thread.actions";
import { UIThread } from "./types";
import { IO_ASSIST_DYNAMIC_CONFIG } from "../../../io-assist.config";
import { ThreadService } from "../../services/thread/thread.service";
import { untrackThreadStreamState } from "../response-stream/response-stream.actions";

@Injectable()
export class ThreadEffects {
    private readonly _actions$: Actions = inject(Actions);
    private readonly _threadService: ThreadService = inject(ThreadService);
    private readonly _dynamicConfig = inject(IO_ASSIST_DYNAMIC_CONFIG);

    fetchThreads$ = createEffect(() =>
        this._actions$.pipe(
            ofType(fetchThreads),
            switchMap(({ agentId }) =>
                from(this._threadService.fetchThreads(agentId, this._dynamicConfig().user.id)).pipe(
                    switchMap((threads: IoAiWeb.Threads.Thread[]) =>
                        from(this._threadService.toUIThreads(threads)).pipe(
                            map((uiThreads: UIThread[]) =>
                                fetchThreadsSuccess({
                                    threads: uiThreads,
                                })
                            ),
                            catchError((error) => of(fetchThreadsFailure({ error })))
                        )
                    )
                )
            )
        )
    );

    renameThread$ = createEffect(() =>
        this._actions$.pipe(
            ofType(renameThread),
            mergeMap((action) =>
                from(this._threadService.renameThread(action.thread, action.newTitle)).pipe(
                    map(() => renameThreadSuccess({ id: action.thread.id, newName: action.newTitle })),
                    catchError((error) => of(renameThreadFailure({ error })))
                )
            )
        )
    );

    deleteThread$ = createEffect(() =>
        this._actions$.pipe(
            ofType(deleteThread),
            mergeMap((action) =>
                from(this._threadService.deleteThread(action.thread)).pipe(
                    map(() => deleteThreadSuccess({ id: action.thread.id })),
                    catchError((error) => of(deleteThreadFailure({ error })))
                )
            )
        )
    );

    /**
     * When a thread is successfully deleted, remove its persisted MCP App
     * preferences so they don't accumulate indefinitely in io.prefs.
     */
    cleanupMcpAppsPrefsOnThreadDelete$ = createEffect(
        () =>
            this._actions$.pipe(
                ofType(deleteThreadSuccess),
                mergeMap(({ id }) => from(this._threadService.deleteThreadState(id)).pipe(catchError(() => EMPTY)))
            ),
        { dispatch: false }
    );

    changeActiveThread$ = createEffect(() =>
        this._actions$.pipe(
            ofType(changeActiveThread),
            map((action) => {
                return untrackThreadStreamState({ threadId: action.threadId ?? "" });
            })
        )
    );
}
