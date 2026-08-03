import { computed, inject, Injectable, Signal } from "@angular/core";
import { Store } from "@ngrx/store";

import { abortThreadStream, clearCompletionNotification, completeThreadStream, failThreadStream, startThreadStream, untrackThreadStreamState, updateStreamContent } from "./response-stream.actions";
import { selectAllStreams, selectHasAnyCompletionNotification, selectStreamingThreadIds, selectThreadsCurrentlyStreaming, selectThreadsWithCompletionNotification } from "./response-stream.selector";
import { RESPONSE_STREAM_STATUS, ThreadStreamState } from "./response-stream.types";
import { UIMessage } from "../message/types";

@Injectable({
    providedIn: "root",
})
export class ResponseStreamFacade {
    private readonly _store: Store = inject(Store);

    private readonly _allStreams: Signal<Record<string, ThreadStreamState>> = this._store.selectSignal(selectAllStreams);
    public get allStreams(): Signal<Record<string, ThreadStreamState>> {
        return this._allStreams;
    }

    private readonly _threadsCurrentlyStreaming: Signal<string[]> = this._store.selectSignal(selectThreadsCurrentlyStreaming);
    public get threadsCurrentlyStreaming(): Signal<string[]> {
        return this._threadsCurrentlyStreaming;
    }

    private readonly _threadsWithCompletionNotification: Signal<string[]> = this._store.selectSignal(selectThreadsWithCompletionNotification);
    public get threadsWithCompletionNotification(): Signal<string[]> {
        return this._threadsWithCompletionNotification;
    }

    private readonly _hasAnyCompletionNotification: Signal<boolean> = this._store.selectSignal(selectHasAnyCompletionNotification);
    public get hasAnyCompletionNotification(): Signal<boolean> {
        return this._hasAnyCompletionNotification;
    }

    private readonly _streamingThreadIds: Signal<Set<string>> = this._store.selectSignal(selectStreamingThreadIds);
    public get streamingThreadIds(): Signal<Set<string>> {
        return this._streamingThreadIds;
    }

    public isThreadStreaming(threadId: string): boolean {
        const stream = this._allStreams()[threadId];
        return stream?.status === RESPONSE_STREAM_STATUS.STREAMING;
    }

    public hasThreadCompletionNotification(threadId: string): boolean {
        const stream = this._allStreams()[threadId];
        return stream?.hasCompletionNotification ?? false;
    }

    public getStreamForThread(threadId: string): ThreadStreamState | null {
        return this._allStreams()[threadId] ?? null;
    }

    public createIsStreamingSignal(threadIdSignal: Signal<string>): Signal<boolean> {
        return computed(() => {
            const threadId = threadIdSignal();
            return this._streamingThreadIds().has(threadId);
        });
    }

    public createHasNotificationSignal(threadIdSignal: Signal<string>): Signal<boolean> {
        return computed(() => {
            const threadId = threadIdSignal();
            return this._threadsWithCompletionNotification().includes(threadId);
        });
    }

    public dispatchStartThreadStream(threadId: string, userMessage: UIMessage): void {
        this._store.dispatch(
            startThreadStream({
                threadId,
                userMessage,
            })
        );
    }

    public dispatchUpdateStreamContent(threadId: string, content: string, messageId: string): void {
        this._store.dispatch(updateStreamContent({ threadId, content, messageId }));
    }

    public dispatchCompleteThreadStream(threadId: string, shouldNotify: boolean): void {
        this._store.dispatch(completeThreadStream({ threadId, shouldNotify }));
    }

    public dispatchFailThreadStream(threadId: string, errorMessage: string): void {
        this._store.dispatch(failThreadStream({ threadId, errorMessage }));
    }

    public dispatchAbortThreadStream(threadId: string): void {
        this._store.dispatch(abortThreadStream({ threadId }));
    }

    public dispatchClearCompletionNotification(threadId: string): void {
        this._store.dispatch(clearCompletionNotification({ threadId }));
    }

    public dispatchUntrackThreadStreamState(threadId: string): void {
        this._store.dispatch(untrackThreadStreamState({ threadId }));
    }
}
