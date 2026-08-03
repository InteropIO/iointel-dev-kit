import { inject, Injectable } from "@angular/core";
import { IOConnectCore } from "@interopio/core";

import { UIPrompt } from "./types";
import { IO_ASSIST_CONFIG, IoAssistStaticConfig } from "../../../io-assist.config";
import { IoAssistPrompt, IoAssistPromptCategory } from "../../../io-assist.types";
import { normalizeIconResource, validateIconResource } from "../../utils/icon.utils";
import { LoggerService } from "../logger/logger.service";

@Injectable({
    providedIn: "root",
})
export class PromptService {
    private readonly _ioAssistConfig: IoAssistStaticConfig = inject(IO_ASSIST_CONFIG);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "PromptService";

    public mapConfigPromptsToUIPrompts(): UIPrompt[] {
        const defaultPrompts: IoAssistPromptCategory[] | undefined = this._ioAssistConfig.defaultPrompts;

        if (!defaultPrompts || defaultPrompts.length === 0) {
            return [];
        }

        return defaultPrompts.flatMap((promptCategory: IoAssistPromptCategory) => {
            const category: string | undefined = promptCategory.category;

            return promptCategory.prompts.map((prompt: IoAssistPrompt) => this._mapIoAssistPromptToUIPrompt(prompt, category));
        });
    }

    private _mapIoAssistPromptToUIPrompt(prompt: IoAssistPrompt, category?: string): UIPrompt {
        const uiPrompt: UIPrompt = {
            name: prompt.name,
            description: prompt.prompt,
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: prompt.prompt,
                    },
                },
            ],
            source: {
                mcpName: "defaultPrompts",
                isUserDefined: false,
            },
            category,
        };

        if (!prompt.iconResource) {
            this.getLogger().warn(`No icon provided for prompt "${prompt.name}". Using default icon.`);

            return uiPrompt;
        }

        // Normalize first (auto-corrects valid type mismatches, e.g. type:'svg' with data: 'data:...' → type:'data-url')
        // Invalid/unknown types and empty data are left as-is so validation below can reject them.
        const normalizedIcon = normalizeIconResource(prompt.iconResource, this.getLogger());

        const validation = validateIconResource(normalizedIcon);

        if (!validation.valid) {
            this.getLogger().warn(`Invalid icon for prompt "${prompt.name}": ${validation.error}. Using default icon.`);

            return uiPrompt;
        }

        uiPrompt.icon = normalizedIcon;

        return uiPrompt;
    }

    private getLogger(): IOConnectCore.Logger.API {
        return this._logger.get(this.LOGGER_NAME);
    }

    // TODO: subscribe to prompt updates prompts/update once we read prompts from backend. Currently,
    // prompts are only from config so no updates happen.
}
