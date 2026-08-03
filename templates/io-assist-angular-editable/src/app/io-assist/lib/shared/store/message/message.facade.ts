import { inject, Injectable, Signal } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { Store } from "@ngrx/store";

import { abortResponseGeneration, clearMessages, fetchMessagesFromThread, getResponse, reloadResponse, toggleToolMessage, toggleToolTrace } from "./message.actions";
import {
    selectAllMessages,
    selectIsFetchedFromThreadSuccess,
    selectIsGeneratingResponse,
    selectIsLastResponseSuccess,
    selectIsLastUserMessage,
    selectIsLoadingMessages,
    selectIsLoadingMessagesFromThread,
    selectLastUserMessage,
    selectLoadingErrorMessage,
    selectMessageLength,
    selectToolTraceState,
} from "./message.selector";
import { GetResponseParams, ToolTraceState, UIMessage, UIUserMessage } from "./types";
import { UIThread } from "../thread/types";

@Injectable()
export class MessageFacade {
    private readonly _store: Store = inject(Store);

    private readonly _allMessages: Signal<UIMessage[]> = this._store.selectSignal<UIMessage[]>(selectAllMessages);
    public get allMessages(): Signal<UIMessage[]> {
        return this._allMessages;
    }

    private readonly _messageLength: Signal<number> = this._store.selectSignal<number>(selectMessageLength);
    public get messageLength(): Signal<number> {
        return this._messageLength;
    }

    private readonly _lastUserMessage: Signal<UIUserMessage | undefined> = this._store.selectSignal<UIUserMessage | undefined>(selectLastUserMessage);
    public get lastUserMessage(): Signal<UIUserMessage | undefined> {
        return this._lastUserMessage;
    }

    private readonly _isLastUserMessage: Signal<boolean> = this._store.selectSignal<boolean>(selectIsLastUserMessage);
    public get isLastUserMessage(): Signal<boolean> {
        return this._isLastUserMessage;
    }

    private readonly _isGeneratingResponse: Signal<boolean> = this._store.selectSignal<boolean>(selectIsGeneratingResponse);
    public get isGeneratingResponse(): Signal<boolean> {
        return this._isGeneratingResponse;
    }

    private readonly _isLoadingMessagesFromThread: Signal<boolean> = this._store.selectSignal<boolean>(selectIsLoadingMessagesFromThread);
    public get isLoadingMessagesFromThread(): Signal<boolean> {
        return this._isLoadingMessagesFromThread;
    }

    private readonly _isLoadingMessages = this._store.selectSignal<boolean>(selectIsLoadingMessages);
    public get isLoadingMessages(): Signal<boolean> {
        return this._isLoadingMessages;
    }

    private readonly _isSuccessFetchedFromThread: Signal<boolean> = this._store.selectSignal<boolean>(selectIsFetchedFromThreadSuccess);
    public get isSuccessFetchedFromThread(): Signal<boolean> {
        return this._isSuccessFetchedFromThread;
    }

    private readonly _loadingErrorMessage: Signal<string | undefined> = this._store.selectSignal<string | undefined>(selectLoadingErrorMessage);

    public get loadingErrorMessage(): Signal<string | undefined> {
        return this._loadingErrorMessage;
    }

    private readonly _toolTraceState = this._store.selectSignal(selectToolTraceState);
    public get toolTraceState(): Signal<ToolTraceState[]> {
        return this._toolTraceState;
    }

    private readonly _isLastResponseSuccess: Signal<boolean> = this._store.selectSignal<boolean>(selectIsLastResponseSuccess);
    public get isLastResponseSuccess(): Signal<boolean> {
        return this._isLastResponseSuccess;
    }

    public getMessageById(id: string): UIMessage {
        const match: UIMessage | undefined = this._allMessages().find((m: UIMessage) => m.id === id);

        if (!match) throw new Error(`Unable to find matching message with id: ${id}`);

        return match;
    }

    public dispatchGetResponse(params: GetResponseParams, threadId: string, isStream?: boolean, agent?: IoAiWeb.Agents.Agent): void {
        this._store.dispatch(getResponse({ params, isStream, agent, threadId }));
    }

    public dispatchReloadResponse(params: GetResponseParams, threadId: string | null, isStream?: boolean, agent?: IoAiWeb.Agents.Agent): void {
        if (!threadId) {
            throw new Error("Cannot reload response: threadId is null");
        }

        this._store.dispatch(reloadResponse({ params, isStream, agent, threadId }));
    }

    public dispatchClearMessages(): void {
        this._store.dispatch(clearMessages());
    }

    public dispatchFetchMessagesFromThread(thread: UIThread): void {
        this._store.dispatch(fetchMessagesFromThread({ thread }));
    }

    public dispatchAbortResponseGeneration(threadId: string): void {
        this._store.dispatch(abortResponseGeneration({ threadId }));
    }

    public dispatchToggleToolTrace(stateForMessageId: string): void {
        this._store.dispatch(toggleToolTrace({ stateForMessageId }));
    }

    public dispatchToggleToolMessage(toolMessageId: string, parentToolTraceId: string): void {
        this._store.dispatch(toggleToolMessage({ toolMessageId, parentToolTraceId }));
    }
}
