import { CommonModule } from "@angular/common";
import { Component, input, InputSignal } from "@angular/core";

import { AppMdFormatterComponent } from "../../../shared/components/app-md-formatter/app-md-formatter.component";
import { UIAssistantMessage } from "../../../shared/store/message/types";
import { MessageFooterComponent } from "../message-footer/message-footer.component";

const MODULES = [CommonModule];
const COMPONENTS = [AppMdFormatterComponent, MessageFooterComponent];

@Component({
    selector: "assistant-message",
    templateUrl: "./assistant-message.component.html",
    imports: [...MODULES, ...COMPONENTS],
})
export class AssistantMessageComponent {
    public readonly message: InputSignal<UIAssistantMessage> = input.required<UIAssistantMessage>();
}
