import React, { useRef, useEffect } from "react";

import { RESPONSE_STREAM_STATUS } from "../../types/stream";
import { IconButton } from "../shared/IconButton";
import { PencilIcon, TrashIcon, Spinner } from "../shared/icons";

type ThreadHistoryListItemProps = {
    threadId: string;
    title: string;
    isActive: boolean;
    isEditing: boolean;
    editValue: string;
    hasNotification: boolean;
    streamStatus?: string;
    onSelect: (threadId: string) => void;
    onStartEditing: (threadId: string, title: string, e: React.MouseEvent) => void;
    onCommitEdit: (threadId: string) => void;
    onEditChange: (value: string) => void;
    onEditKeyDown: (e: React.KeyboardEvent, threadId: string) => void;
    onDelete: (threadId: string, e: React.MouseEvent) => void;
};

export const ThreadHistoryListItem: React.FC<ThreadHistoryListItemProps> = ({
    threadId,
    title,
    isActive,
    isEditing,
    editValue,
    hasNotification,
    streamStatus,
    onSelect,
    onStartEditing,
    onCommitEdit,
    onEditChange,
    onEditKeyDown,
    onDelete,
}) => {
    const editRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && editRef.current) {
            editRef.current.focus();
            editRef.current.select();
        }
    }, [isEditing]);

    const isThreadStreaming = streamStatus === RESPONSE_STREAM_STATUS.STREAMING;
    const showNotificationBadge = hasNotification && !isActive;
    const isThreadActionPending = isThreadStreaming;

    return (
        <div
            role="button"
            data-testid="thread-list-item"
            data-thread-id={threadId}
            data-active={isActive ? "true" : "false"}
            aria-current={isActive ? "true" : undefined}
            tabIndex={0}
            className={[
                "group flex flex-1 justify-start gap-2 h-8 rounded-md cursor-pointer",
                isActive ? "bg-[var(--app-thread-list-item-active-background)]" : "hover:bg-thread-list-item-hover-background",
            ].join(" ")}
            onClick={() => !isEditing && onSelect(threadId)}
            onKeyUp={(e) => e.key === "Enter" && !isEditing && onSelect(threadId)}
        >
            <div className="flex items-center gap-2 cursor-pointer p-2 flex-1 min-w-0">
                {!isEditing && (
                    <div className={["flex items-center text-xs flex-1 min-w-0 overflow-hidden", isActive ? "text-text-states-active" : "text-text-default"].join(" ")}>
                        {showNotificationBadge && <span data-testid="thread-list-item-notification" className="size-2 rounded-full bg-orange-500 mr-2 flex-shrink-0" title="New response available" />}
                        <span className="truncate block" title={title}>
                            {title}
                        </span>
                        {isThreadActionPending && <Spinner testId="thread-list-item-spinner" className="ml-2 flex-shrink-0 size-3 border-[1.5px]" />}
                    </div>
                )}

                {isEditing && (
                    <input
                        ref={editRef}
                        data-testid="thread-name-input"
                        aria-label="Rename thread"
                        className="flex-1 min-w-0 h-6 -mx-1 px-[3px] text-xs text-text-states-active bg-input-background border border-input-border-active rounded-md outline-none"
                        value={editValue}
                        onChange={(e) => onEditChange(e.target.value)}
                        onBlur={() => onCommitEdit(threadId)}
                        onKeyDown={(e) => onEditKeyDown(e, threadId)}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}

                {/* Thread Action Buttons */}
                {!isEditing && (
                    <div className={["gap-[2px] ml-auto items-center pr-1", isActive ? "flex" : "hidden group-hover:flex"].join(" ")}>
                        <IconButton
                            testId="thread-edit-button"
                            size={12}
                            containerSize={24}
                            shape="rounded-square"
                            className="hover:bg-icon-button-selected"
                            tabIndex={isActive ? 0 : -1}
                            title="Rename"
                            disabled={isThreadActionPending}
                            onClick={(e) => onStartEditing(threadId, title, e)}
                        >
                            <PencilIcon />
                        </IconButton>
                        <IconButton
                            testId="thread-delete-button"
                            size={12}
                            containerSize={24}
                            shape="rounded-square"
                            className="hover:bg-icon-button-selected"
                            tabIndex={isActive ? 0 : -1}
                            title="Delete"
                            disabled={isActive || isThreadActionPending}
                            onClick={(e) => onDelete(threadId, e)}
                        >
                            <TrashIcon />
                        </IconButton>
                    </div>
                )}
            </div>
        </div>
    );
};
