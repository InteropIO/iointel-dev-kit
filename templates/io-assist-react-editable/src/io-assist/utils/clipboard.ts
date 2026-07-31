import { logger } from "./logger";

const LOGGER_NAME = "Clipboard";
const log = logger.get(LOGGER_NAME);

/**
 * Copies text to the clipboard. Mirrors ng's CopyToClipboardService: it first
 * tries the async Clipboard API, then falls back to a hidden textarea +
 * document.execCommand('copy').
 *
 * The fallback is required when io.Assist is rendered inside an iframe whose
 * permissions policy blocks the Clipboard API (Chrome surfaces this as
 * "The Clipboard API has been blocked because of a permissions policy applied
 * to the current document"), as well as for non-HTTPS contexts or denied
 * permission.
 */
export async function copyToClipboard(text: string): Promise<void> {
    try {
        if (!navigator.clipboard?.writeText) {
            throw new Error("Clipboard API not available");
        }
        await navigator.clipboard.writeText(text);
        log.info("Text copied to clipboard successfully");
        return;
    } catch (err) {
        log.warn(`Failed to copy text using Clipboard API, falling back to textarea method: ${err instanceof Error ? err.message : String(err)}`);
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    // Keep the textarea off-screen and non-interactive to avoid a flash,
    // viewport shift, or tab focus.
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.left = "-9999px";
    textarea.tabIndex = -1;

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        document.execCommand("copy");
    } finally {
        document.body.removeChild(textarea);
    }
}
