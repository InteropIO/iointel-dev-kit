import React, { useState } from "react";

import { ThreadHistoryListItem } from "./ThreadHistoryListItem";
import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";
import { useIoAiWebApi } from "../../hooks/useIoAiWebApi";
import { LOADING_STATES } from "../../types/loading";
import { groupThreadsByTime } from "../../utils/threadUtils";
import { Spinner } from "../shared/icons";

type ThreadHistoryProps = {
    onThreadSelected?: () => void;
};

export const ThreadHistory: React.FC<ThreadHistoryProps> = ({ onThreadSelected }) => {
    const threads = useIoAssistStore((s) => s.threads);
    const activeThreadId = useIoAssistStore((s) => s.activeThreadId);
    const completionNotifications = useIoAssistStore((s) => s.completionNotifications);
    const streamsByThreadId = useIoAssistStore((s) => s.streamsByThreadId);
    const threadLoadingState = useIoAssistStore((s) => s.threadLoadingState);

    const { selectThread, renameThread, deleteThread } = useIoAiWebApi();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const groups = groupThreadsByTime(threads);
    const isFetchingThreads = threadLoadingState.type === LOADING_STATES.LOADING;

    const startEditing = (threadId: string, currentTitle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(threadId);
        setEditValue(currentTitle);
    };

    const commitEdit = (threadId: string) => {
        void renameThread(threadId, editValue);
        setEditingId(null);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent, threadId: string) => {
        if (e.key === "Enter") {
            e.preventDefault();
            commitEdit(threadId);
        } else if (e.key === "Escape") {
            setEditingId(null);
        }
    };

    const handleDelete = (threadId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        void deleteThread(threadId);
    };

    const handleSelectThread = async (threadId: string): Promise<void> => {
        await selectThread(threadId);
        onThreadSelected?.();
    };

    return (
        <div data-testid="thread-history" className="flex flex-1 flex-col p-2 overflow-y-auto custom-scrollbar">
            {isFetchingThreads && (
                <div className="flex flex-1 justify-center items-center">
                    <Spinner />
                </div>
            )}

            {!isFetchingThreads && groups.length === 0 && <p className="flex flex-1 justify-center items-center text-text-default text-xs">{UI_STRINGS.THREAD_HISTORY_COMPONENT.NO_THREADS}</p>}

            {!isFetchingThreads &&
                groups.map((group) => (
                    <div key={group.label} data-testid="thread-history-list">
                        <div data-testid="thread-history-divider" className="p-2 pb-0">
                            <span className="text-xs text-proto-text-disabled cursor-default">{group.label}</span>
                        </div>
                        {group.threads.map((thread) => (
                            <ThreadHistoryListItem
                                key={thread.id}
                                threadId={thread.id}
                                title={thread.title ?? thread.id}
                                isActive={thread.id === activeThreadId}
                                isEditing={editingId === thread.id}
                                editValue={editValue}
                                hasNotification={completionNotifications.includes(thread.id)}
                                streamStatus={streamsByThreadId[thread.id]?.status}
                                onSelect={(id) => void handleSelectThread(id)}
                                onStartEditing={startEditing}
                                onCommitEdit={commitEdit}
                                onEditChange={setEditValue}
                                onEditKeyDown={handleEditKeyDown}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                ))}
        </div>
    );
};
