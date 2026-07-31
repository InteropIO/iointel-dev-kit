import { CommonModule } from "@angular/common";
import { Component, computed, inject, Signal, OnInit, WritableSignal } from "@angular/core";

import { AppSpinnerComponent } from "../../../shared/components/app-spinner/app-spinner.component";
import { APP_SPINNER_COMPONENT_SIZE } from "../../../shared/components/app-spinner/enum";
import { SELECTED_AGENT } from "../../../shared/constants/agents";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { ComponentEffectManagerService as EffectService } from "../../../shared/services/component-effect-manager/component-effect-manager.service";
import { OverlayService } from "../../../shared/services/overlay/overlay.service";
import { MessageFacade } from "../../../shared/store/message/message.facade";
import { ThreadFacade } from "../../../shared/store/thread/thread.facade";
import { UIThread } from "../../../shared/store/thread/types";
import { ThreadHistoryListItemComponent } from "../thread-history-list-item/thread-history-list-item.component";
import { ThreadHistoryListItemDividerComponent } from "../thread-history-list-item-divider/thread-history-list-item-divider.component";

export type ThreadWithDivider = {
    thread: UIThread;
    showDivider: boolean;
    divider: string;
};

const MODULES = [CommonModule];
const COMPONENTS = [ThreadHistoryListItemComponent, ThreadHistoryListItemDividerComponent, AppSpinnerComponent];

@Component({
    selector: "thread-history-list",
    templateUrl: "./thread-history-list.component.html",
    imports: [...MODULES, ...COMPONENTS],
    providers: [
        {
            provide: EffectService,
            useFactory: () => new EffectService("ThreadHistoryListComponent"),
        },
    ],
})
export class ThreadHistoryListComponent implements OnInit {
    protected readonly UI_STRINGS = UI_STRINGS.THREAD_HISTORY_COMPONENT;
    protected readonly UI_STRINGS_GENERAL = UI_STRINGS.GENERAL;
    protected readonly APP_SPINNER_COMPONENT_SIZE = APP_SPINNER_COMPONENT_SIZE;

    // Provided in root
    private readonly _threadFacade: ThreadFacade = inject(ThreadFacade);
    private readonly _overlayService: OverlayService = inject(OverlayService);

    // Provided by parent
    private readonly _messageFacade: MessageFacade = inject(MessageFacade);

    private readonly _effectService: EffectService = inject(EffectService);

    protected readonly isFetchingThreads: Signal<boolean> = this._threadFacade.isFetchingThreads;
    protected readonly threads: Signal<UIThread[]> = this._threadFacade.allThreads;
    protected readonly threadsWithDivider: Signal<ThreadWithDivider[]> = computed<ThreadWithDivider[]>(() => {
        const result: ThreadWithDivider[] = [];
        let lastDivider: string = "";

        // Perform sort by date
        const filteredThreads: UIThread[] = [...this.threads()].sort(
            (a: UIThread, b: UIThread) => new Date(b.updatedAt ? b.updatedAt : b.createdAt).getTime() - new Date(a.updatedAt ? a.updatedAt : a.createdAt).getTime()
        );

        filteredThreads.forEach((thread: UIThread) => {
            const divider: string = this.getDividerLabel(new Date(thread.updatedAt ? thread.updatedAt : thread.createdAt));
            const showDivider: boolean = divider !== lastDivider;
            lastDivider = divider;

            result.push({ thread, showDivider, divider });
        });

        return result;
    });

    private readonly _isThreadHistoryDisplayed: WritableSignal<boolean> = this._overlayService.isThreadHistoryDisplayed;
    private readonly _isSuccessLastResponse: Signal<boolean> = this._messageFacade.isLastResponseSuccess;

    public ngOnInit(): void {
        this.registerEffects();

        // TODO: Configure agentId and resourceId properly
        this._threadFacade.dispatchFetchThreads(SELECTED_AGENT);
    }

    public getDividerLabel(date: Date): string {
        const diffMs: number = Date.now() - date.getTime();
        const diffMinutes: number = Math.floor(diffMs / (1000 * 60));
        const diffHours: number = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays: number = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 5) return this.UI_STRINGS.DIVIDERS.JUST_NOW;
        if (diffMinutes < 30) return this.UI_STRINGS.DIVIDERS.FIVE_MINS_AGO;
        if (diffMinutes < 60) return this.UI_STRINGS.DIVIDERS.THIRTY_MINS_AGO;
        if (diffHours < 1) return this.UI_STRINGS.DIVIDERS.ONE_HOUR_AGO;
        if (diffHours < 2) return this.UI_STRINGS.DIVIDERS.TWO_HOURS_AGO;
        if (diffHours < 6) return this.UI_STRINGS.DIVIDERS.SIX_HOURS_AGO;
        if (diffHours < 12) return this.UI_STRINGS.DIVIDERS.TWELVE_HOURS_AGO;
        if (diffDays === 0) return this.UI_STRINGS.DIVIDERS.TODAY;
        if (diffDays === 1) return this.UI_STRINGS.DIVIDERS.YESTERDAY;
        if (diffDays === 2) return this.UI_STRINGS.DIVIDERS.TWO_DAYS_AGO;
        if (diffDays < 7) return this.UI_STRINGS.DIVIDERS.LAST_WEEK;
        if (diffDays < 14) return this.UI_STRINGS.DIVIDERS.TWO_WEEKS_AGO;
        if (diffDays < 30) return this.UI_STRINGS.DIVIDERS.ONE_MONTH_AGO;
        if (diffDays < 90) return this.UI_STRINGS.DIVIDERS.THREE_MONTHS_AGO;
        if (diffDays < 180) return this.UI_STRINGS.DIVIDERS.SIX_MONTHS_AGO;

        return this.UI_STRINGS.DIVIDERS.MORE_THAN_YEAR_AGO;
    }

    private registerEffects(): void {
        this._effectService.registerEffect("ThreadHistoryListComponent.shouldRefreshThreadList.when.successfulResponse", () => {
            const shouldRefresh: boolean = this._isThreadHistoryDisplayed() && this._isSuccessLastResponse();

            if (!shouldRefresh) {
                return;
            }

            this._threadFacade.dispatchFetchThreads(SELECTED_AGENT);
        });
    }
}
