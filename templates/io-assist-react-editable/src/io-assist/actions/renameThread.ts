import type { IoAssistStoreInstance } from "../stores";

export async function renameThread(store: IoAssistStoreInstance, threadId: string, title: string): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) return;

    const state = store.getState();
    const thread = state.threads.find((t) => t.id === threadId);
    if (!thread) return;

    const previousTitle = thread.title;
    state.updateThread(threadId, { title: trimmed });

    try {
        await thread.update({ title: trimmed });
    } catch {
        store.getState().updateThread(threadId, { title: previousTitle });
    }
}
