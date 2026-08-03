import { inject, Injectable, Signal } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { mergeMap, catchError, of, from, map, tap, Observable, switchMap, EMPTY } from "rxjs";

import {
    abortResponseGeneration,
    fetchMessagesFromThread,
    fetchMessagesFromThreadFailure,
    fetchMessagesFromThreadSuccess,
    getResponse,
    getResponseFailure,
    mergeAccumulatedStreamContent,
    reloadResponse,
} from "./message.actions";
import { handleResponseStream } from "./message.utils";
import { UIMessage, UIResponseMessage, UIToolMessage, UI_MESSAGE_ROLES } from "./types";
import { AgentService } from "../../services/agent/agent.service";
import { LoggerService } from "../../services/logger/logger.service";
import { McpAppsService } from "../../services/mcp-apps/mcp-apps.service";
import { ThreadService } from "../../services/thread/thread.service";
import { abortThreadStream, completeThreadStream, failThreadStream, startThreadStream } from "../response-stream/response-stream.actions";
import { selectIsThreadStreaming, selectStreamContentForThread } from "../response-stream/response-stream.selector";
import { changeActiveThread } from "../thread/thread.actions";
import { selectActiveThreadId } from "../thread/thread.selector";

@Injectable()
export class MessageEffects {
    private readonly _actions$: Actions = inject(Actions);
    private readonly _agentService: AgentService = inject(AgentService);
    private readonly _threadService: ThreadService = inject(ThreadService);
    private readonly _store: Store = inject(Store);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "MessageEffects";
    private readonly _mcpAppsService: McpAppsService = inject(McpAppsService);

    private readonly _activeThreadId: Signal<string | null> = this._store.selectSignal(selectActiveThreadId);

    /**
     * When the user switches to any thread (including a new/empty one), clear the
     * tracked app instances and close all active proxy windows immediately.
     * This prevents stale workspace windows from persisting during the async
     * fetch that follows, and ensures windows stuck in the loading state (proxy-
     * ready not yet fired) are also closed via the safety-net closeAll().
     */
    clearMcpAppsOnThreadChange$ = createEffect(
        () =>
            this._actions$.pipe(
                ofType(changeActiveThread),
                switchMap(() => {
                    this._mcpAppsService.resetInstances();

                    return from(this._mcpAppsService.closeAll()).pipe(catchError(() => EMPTY));
                })
            ),
        { dispatch: false }
    );

    /**
     * When messages are fetched for an existing thread, atomically close all
     * existing MCP App instances and create new ones for the fetched thread.
     * Uses replaceAll() to prevent race conditions from rapid thread switching —
     * switchMap cancels in-flight operations, and replaceAll starts with a clean slate.
     */
    createMcpAppsOnThreadFetch$ = createEffect(
        () =>
            this._actions$.pipe(
                ofType(fetchMessagesFromThreadSuccess),
                switchMap(({ messages, threadId }) => {
                    const apps = messages
                        .filter((m): m is UIToolMessage => m.role === UI_MESSAGE_ROLES.TOOL)
                        .map((m) => ({
                            toolCallId: m.id,
                            toolName: m.toolName,
                            toolInput: m.args,
                            toolResult: m.result,
                        }));

                    return from(apps.length > 0 ? this._mcpAppsService.recreate({ threadId, apps }) : this._mcpAppsService.closeAll()).pipe(catchError(() => EMPTY));
                })
            ),
        { dispatch: false }
    );

    getResponse$ = createEffect(() =>
        this._actions$.pipe(
            ofType(getResponse),
            tap(({ params, threadId }) => this._dispatchStreamForThread(params, threadId, "getResponse")),
            mergeMap(({ params, isStream, agent, threadId }) =>
                from(this._agentService.getResponse(params, isStream, agent)).pipe(
                    mergeMap((responseStream) => this._getResponseStreamHandler(responseStream, threadId)),
                    catchError((error: Error) => this._handleStreamError(error, threadId))
                )
            )
        )
    );

    reloadResponse$ = createEffect(() =>
        this._actions$.pipe(
            ofType(reloadResponse),
            tap(({ params, threadId }) => this._dispatchStreamForThread(params, threadId, "reloadResponse")),
            mergeMap(({ params, isStream, agent, threadId }) =>
                from(this._agentService.reloadResponse(params, isStream, agent)).pipe(
                    mergeMap((responseStream) => this._getResponseStreamHandler(responseStream, threadId)),
                    catchError((error: Error) => this._handleStreamError(error, threadId))
                )
            )
        )
    );

    fetchMessagesFromThread$ = createEffect(() =>
        this._actions$.pipe(
            ofType(fetchMessagesFromThread),
            switchMap(({ thread }) =>
                from(this._threadService.fetchMessagesFromThread(thread)).pipe(
                    map((messages: UIResponseMessage[]) => {
                        return fetchMessagesFromThreadSuccess({ messages, threadId: thread.id });
                    }),
                    catchError((error: Error) => of(fetchMessagesFromThreadFailure({ error })))
                )
            )
        )
    );

    /**
     * Effect to merge accumulated stream content after fetching messages.
     * This ensures content streamed while viewing another thread is preserved.
     * Includes user message, tool messages, and assistant content.
     */
    mergeAccumulatedContent$ = createEffect(() =>
        this._actions$.pipe(
            ofType(fetchMessagesFromThreadSuccess),
            mergeMap(({ threadId }) => {
                // Check if this thread is currently streaming
                const isStreaming: boolean = this._store.selectSignal(selectIsThreadStreaming(threadId))();

                if (!isStreaming) {
                    return [];
                }

                // Get accumulated content for this thread
                const streamContent = this._store.selectSignal(selectStreamContentForThread(threadId))();

                return of(
                    mergeAccumulatedStreamContent({
                        content: streamContent?.content ?? "",
                        messageId: streamContent?.messageId ?? null,
                        threadId,
                        userMessage: streamContent?.userMessage ?? null,
                        toolMessages: streamContent?.toolMessages ?? [],
                    })
                );
            })
        )
    );

    abortResponseGeneration$ = createEffect(
        () =>
            this._actions$.pipe(
                ofType(abortResponseGeneration),
                tap(({ threadId }) => {
                    this._store.dispatch(abortThreadStream({ threadId }));
                    this._agentService.abortOperation(threadId);
                })
            ),
        { dispatch: false }
    );

    /** Notify MCP apps that a response stream has started. */
    notifyMcpAppsStreamStart$ = createEffect(
        () =>
            this._actions$.pipe(
                ofType(startThreadStream),
                tap(() => this._mcpAppsService.notifyPendingResponse(true))
            ),
        { dispatch: false }
    );

    /** Notify MCP apps that a response stream has ended (completed, aborted, or failed). */
    notifyMcpAppsStreamEnd$ = createEffect(
        () =>
            this._actions$.pipe(
                ofType(completeThreadStream, abortThreadStream, failThreadStream),
                tap(() => this._mcpAppsService.notifyPendingResponse(false))
            ),
        { dispatch: false }
    );

    private _dispatchStreamForThread(params: { messages: unknown[] }, threadId: string, actionName: string): void {
        const userMessages: UIMessage[] = params.messages as UIMessage[];
        const userMessage: UIMessage | null = userMessages.length > 0 ? userMessages[0] : null;

        if (!userMessage) {
            this._logger.get(this.LOGGER_NAME).warn(`Something went wrong. No user message found in parameters for ${actionName} action.`);
            return;
        }

        this._store.dispatch(startThreadStream({ threadId, userMessage }));
    }

    private _createShouldAbortCallback(threadId: string): () => boolean {
        return () => {
            const activeThreadId: string | null = this._activeThreadId();
            // Means streaming ongoing in background without user being on any thread (when he moves out from new thread while it streams)
            const isNewThread: boolean = activeThreadId === null;

            return isNewThread || activeThreadId !== threadId;
        };
    }

    private _getResponseStreamHandler(
        runHandle: IoAiWeb.Agents.StreamResponse,
        threadId: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Observable<any> {
        return handleResponseStream(runHandle, threadId, this._createShouldAbortCallback(threadId), this._logger.get(this.LOGGER_NAME));
    }

    private _handleStreamError(error: Error, threadId: string) {
        this._store.dispatch(
            failThreadStream({
                threadId,
                errorMessage: error.message,
            })
        );
        return of(getResponseFailure({ error, threadId }));
    }
}
