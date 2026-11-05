import { Component, inject, Signal } from "@angular/core";

import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { IOAiWebService } from "../../../shared/services/io-ai-web/io-ai-web.service";
import { ToolFacade } from "../../../shared/store/tool/tool.facade";

@Component({
    selector: "tools-panel-footer",
    templateUrl: "./tools-panel-footer.component.html",
    providers: [ToolFacade],
    host: {
        class: "block w-full",
    },
})
export class ToolsPanelFooterComponent {
    protected readonly UI_STRINGS = UI_STRINGS.TOOLS_PANEL_FOOTER_COMPONENT;

    private readonly _toolFacade: ToolFacade = inject(ToolFacade);
    private readonly _ioAiWebService: IOAiWebService = inject(IOAiWebService);

    protected readonly isCodeModeEnabled: Signal<boolean> = this._ioAiWebService.isCodeModeEnabled;
}
