export enum RESPONSE_STREAM_ACTIONS {
    START_THREAD_STREAM = "[Response Stream] Start Thread Stream",
    UPDATE_STREAM_CONTENT = "[Response Stream] Update Stream Content",
    ADD_STREAM_TOOL_MESSAGE = "[Response Stream] Add Stream Tool Message",
    COMPLETE_THREAD_STREAM = "[Response Stream] Complete Thread Stream",
    FAIL_THREAD_STREAM = "[Response Stream] Fail Thread Stream",
    ABORT_THREAD_STREAM = "[Response Stream] Abort Thread Stream",
    CLEAR_COMPLETION_NOTIFICATION = "[Response Stream] Clear Completion Notification",
    CLEAR_ALL_COMPLETION_NOTIFICATIONS = "[Response Stream] Clear All Completion Notifications",
    UNTRACK_THREAD_STREAM_STATE = "[Response Stream] Untrack Thread Stream State",
}
