import { inject, Injectable } from "@angular/core";

import { LoggerService } from "../logger/logger.service";

@Injectable()
export class CopyToClipboardService {
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "CopyToClipboardService";
    public copyToClipboard = async (text: string): Promise<void> => {
        if (!navigator.clipboard) throw new Error("Clipboard API not available");

        if (!navigator.clipboard.writeText) throw new Error("Clipboard writeText method not available");

        try {
            await navigator.clipboard.writeText(text);

            this._logger.get(this.LOGGER_NAME).info("Text copied to clipboard successfully");
        } catch (err) {
            this._logger.get(this.LOGGER_NAME).warn(`Failed to copy text using Clipboard API, falling back to textarea method: ${err instanceof Error ? err.message : String(err)}`);

            /**
             * Fallback when the Clipboard API is not available or fails
             * Reasons that it might fail include:
             * - The user denied permission
             * - The page is not served over HTTPS
             * - The browser doesn't support it or app is rendered in an iframe
             */
            const textarea = document.createElement("textarea");

            textarea.value = text; // Set the text to be copied

            // Other styling to avoid flash of textarea, moving viewport or tabbing into it
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            textarea.tabIndex = -1;
            textarea.style.left = "-9999px";

            document.body.appendChild(textarea);

            textarea.focus();
            textarea.select();

            // Copy the text
            document.execCommand("copy");

            // Clean up
            document.body.removeChild(textarea);
        }
    };
}
