import { CommonModule } from "@angular/common";
import { Component, inject, input, InputSignal } from "@angular/core";

import { AppIconComponent } from "../../../shared/components/app-icon/app-icon.component";
import { APP_ICON_SIZES, APP_ICON_VARIANTS } from "../../../shared/components/app-icon/enum";
import { AppMdFormatterComponent } from "../../../shared/components/app-md-formatter/app-md-formatter.component";
import { textToJSONMarkdown } from "../../../shared/components/app-md-formatter/utils";
import { UI_STRINGS } from "../../../shared/constants/ui-strings";
import { MessageFacade } from "../../../shared/store/message/message.facade";
import { TOOL_RESULT_TYPES, ToolResult, UIToolMessage } from "../../../shared/store/message/types";

const MODULES = [CommonModule];
const COMPONENTS = [AppIconComponent, AppMdFormatterComponent];

@Component({
    selector: "tool-message",
    templateUrl: "./tool-message.component.html",
    imports: [...MODULES, ...COMPONENTS],
    styleUrls: ["./tool-message.component.css"],
})
export class ToolMessageComponent {
    protected readonly APP_ICON_VARIANTS = APP_ICON_VARIANTS;
    protected readonly APP_ICON_SIZES = APP_ICON_SIZES;
    protected readonly UI_STRINGS = UI_STRINGS.TOOL_MESSAGE;

    public readonly message: InputSignal<UIToolMessage> = input.required<UIToolMessage>();
    public readonly parentToolTraceId: InputSignal<string> = input.required<string>();

    private readonly _messageFacade: MessageFacade = inject(MessageFacade);

    protected handleToggle(): void {
        this._messageFacade.dispatchToggleToolMessage(this.message().id, this.parentToolTraceId());
    }

    protected handleArgsToJSONMarkdown(): string {
        return textToJSONMarkdown(this.message().args);
    }

    protected handleResultToJSONMarkdown(): string {
        const result = this.message().result;

        if (!result) {
            return "No result available.";
        }

        if (!Array.isArray(result)) {
            const parsedResult = this.parseTextResultTextContent(result);

            return textToJSONMarkdown(parsedResult);
        }

        const parsedResults: ToolResult[] = result.map((res: ToolResult) => {
            if (res.type === TOOL_RESULT_TYPES.TEXT) {
                return this.parseTextResultTextContent(res);
            }

            /**
             *
             * TODO: Custom handling for other MCP result types: image, audio
             * For now, return as is:
             *
             * Image Content
             * {
             *   "type": "image",
             *   "data": "base64-encoded-image-data",
             *   "mimeType": "image/jpeg"
             * }
             *
             * Audio Content:
             * {
             *   "type": "audio",
             *   "data": "base64-encoded-audio-data",
             *   "mimeType": "audio/mpeg"
             * }
             */
            return res;
        });

        return parsedResults.map((res) => textToJSONMarkdown(res)).join("\n\n---\n\n");
    }

    private parseTextResultTextContent(result: ToolResult): ToolResult {
        let parsedText: unknown;

        if (result.type !== TOOL_RESULT_TYPES.TEXT) {
            return result;
        }

        if (result.type === TOOL_RESULT_TYPES.TEXT) {
            try {
                parsedText = JSON.parse(result.text as string);
                // eslint-disable-next-line unused-imports/no-unused-vars
            } catch (_unusedErr: unknown) {
                parsedText = result.text;
            }
        }

        return {
            type: result.type,
            text: parsedText,
        } as ToolResult;
    }
}
