import type { IoAiWeb } from '@interopio/ai-web';

import type { IoAssistStoreInstance } from '../stores';
import { LOADING_STATES } from '../types';
import type { UIThread } from '../types';

export async function refreshThreads(ioIntelWeb: IoAiWeb.API, agentId: string, userId: string, store: IoAssistStoreInstance, trackLoadingState = false): Promise<void> {
    const state = store.getState();

    if (trackLoadingState) {
        state.setThreadLoadingState({ type: LOADING_STATES.LOADING });
    }

    try {
        const rawThreads = await ioIntelWeb.threads.list({ agentId, resourceId: userId });

        const threads: UIThread[] = rawThreads.map((t) => ({
            id: t.id,
            title: t.title || t.id.substring(0, 8),
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
            rawThread: t,
            update: (params: { title: string }) => t.update(params),
            delete: () => t.delete(),
            getMessages: (params: { limit: number }) => t.getMessages(params),
        }));

        store.getState().setThreads(threads);

        if (trackLoadingState) {
            store.getState().setThreadLoadingState({ type: LOADING_STATES.SUCCESS });
        }
    } catch (error) {
        if (trackLoadingState) {
            store.getState().setThreadLoadingState({
                type: LOADING_STATES.ERROR,
                message: error instanceof Error ? error.message : 'Failed to load threads',
            });
        }
    }
}
