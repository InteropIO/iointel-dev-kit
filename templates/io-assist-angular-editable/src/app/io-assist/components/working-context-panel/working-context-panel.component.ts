import { CommonModule } from "@angular/common";
import { Component, inject, OnInit, Signal } from "@angular/core";
import { IoIntelWorkingContext } from "@interopio/working-context";

import { AppIconComponent } from "../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../shared/components/app-icon/enum";
import { AppMdFormatterComponent } from "../../shared/components/app-md-formatter/app-md-formatter.component";
import { textToJSONMarkdown } from "../../shared/components/app-md-formatter/utils";
import { UI_STRINGS } from "../../shared/constants/ui-strings";
import { SubscriptionCleanupService } from "../../shared/services/subscription-cleanup/subscription-cleanup.service";
import { WorkingContextService } from "../../shared/services/working-context/working-context.service";
import { WorkingContextFacade } from "../../shared/store/working-context/working-context.facade";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent, AppMdFormatterComponent];

@Component({
    selector: "working-context-panel",
    templateUrl: "./working-context-panel.component.html",
    styleUrls: ["./working-context-panel.component.css"],
    imports: [...MODULES, ...COMPONENTS],
    providers: [WorkingContextFacade, SubscriptionCleanupService],
})
export class WorkingContextPanelComponent implements OnInit {
    protected readonly UI_STRINGS = UI_STRINGS.WORKING_CONTEXT_PANEL_COMPONENT;
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;

    private readonly WORKING_CONTEXT_CHANGES_SUB_KEY = "working-context-changes-panel-subscription";

    private readonly _workingContextService: WorkingContextService = inject(WorkingContextService);
    private readonly _subscriptionCleanupService: SubscriptionCleanupService = inject(SubscriptionCleanupService);

    // Provided in this component
    private readonly _workingContextFacade: WorkingContextFacade = inject(WorkingContextFacade);

    protected readonly workingContext: Signal<Record<string, IoIntelWorkingContext.Property>> = this._workingContextFacade.workingContext;

    private _unsubscribeFn: (() => void) | undefined | null;

    public ngOnInit(): void {
        this._workingContextFacade.dispatchGetWorkingContext();

        this._unsubscribeFn = this._workingContextService.onWorkingContextChange((workingContext) => {
            this._workingContextFacade.dispatchUpdateWorkingContext(workingContext);
        });

        if (!this._unsubscribeFn) {
            return;
        }

        this._subscriptionCleanupService.add(this.WORKING_CONTEXT_CHANGES_SUB_KEY, this._unsubscribeFn);
    }

    protected textToJSONMarkdown(): string {
        return textToJSONMarkdown(this.workingContext());
    }
}
