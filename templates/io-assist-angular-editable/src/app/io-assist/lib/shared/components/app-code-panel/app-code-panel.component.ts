import { CommonModule } from "@angular/common";
import { Component, computed, effect, ElementRef, input, InputSignal, Signal, signal, viewChild, WritableSignal } from "@angular/core";
import * as Prism from "prismjs";

// Registers Prism languages used by this panel (Prism is a global singleton — these
// side-effect imports make `javascript`/`json`/`clike` available regardless of load order).
import "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";

import { AppCopyToClipboardButtonComponent } from "../app-copy-to-clipboard-button/app-copy-to-clipboard-button.component";

// Any Prism grammar name works; unknown or unloaded grammars render as plain text.
export type AppCodePanelLanguage = "javascript" | "json" | "text" | (string & {});

type AppCodePanelLine = {
    number: number;
    html: string;
};

// Mutable working state threaded through the splitHighlightedHtmlIntoLines helper methods.
type HighlightSplitState = {
    lines: string[];
    openTags: string[];
    current: string;
};

const MODULES = [CommonModule];
const COMPONENTS = [AppCopyToClipboardButtonComponent];

/**
 * Shared line-numbered, syntax-highlighted code/JSON viewer. Follows the app theme: a dark
 * panel and palette by default, a light panel with a light-background syntax palette under
 * the app's light theme.
 *
 * Available Inputs:
 * @input label - Required. Caption shown in the header (or as a small inline caption when embedded)
 * @input code - Required. The code/text content to render
 * @input language - Prism grammar name to highlight with (default: json)
 * @input fillHeight - Set true only when an ancestor has a real fixed height to distribute (e.g.
 *     a fixed-height modal panel) — flex-grow needs that to produce a non-zero size. Left false
 *     (default) for inline usage, where the panel just sizes to its content up to its own
 *     max-height and scrolls internally beyond that.
 * @input showHeader - Hide the label/copy header when the host already provides its own actions
 *     (default: true)
 * @input isEmbedded - Embedded in a container that already has its own border and header: no
 *     border/radius of its own, and the label becomes a small caption above the code (default: false)
 * @input showInlineLabel - Embedded hosts that show the language label themselves turn this off
 *     (default: true)
 */
@Component({
    selector: "app-code-panel",
    templateUrl: "./app-code-panel.component.html",
    styleUrls: ["./app-code-panel.component.css"],
    imports: [...MODULES, ...COMPONENTS],
    host: {
        "[class.app-code-panel-host--fill]": "fillHeight()",
        "[class.app-code-panel-host--embedded]": "isEmbedded()",
    },
})
export class AppCodePanelComponent {
    public readonly label: InputSignal<string> = input.required<string>();
    public readonly code: InputSignal<string> = input.required<string>();
    public readonly language: InputSignal<AppCodePanelLanguage> = input<AppCodePanelLanguage>("json");
    public readonly fillHeight: InputSignal<boolean> = input<boolean>(false);
    public readonly showHeader: InputSignal<boolean> = input<boolean>(true);
    public readonly isEmbedded: InputSignal<boolean> = input<boolean>(false);
    public readonly showInlineLabel: InputSignal<boolean> = input<boolean>(true);

    protected readonly prismLanguage: Signal<string> = computed<string>(() => {
        const language = this.language().trim().toLowerCase();

        return !language || language === "text" || language === "plaintext" ? "plain" : language;
    });

    protected readonly canScrollUp: WritableSignal<boolean> = signal<boolean>(false);
    protected readonly canScrollDown: WritableSignal<boolean> = signal<boolean>(false);

    private readonly _codeAreaRef = viewChild<ElementRef<HTMLElement>>("codeArea");

    constructor() {
        effect((onCleanup) => {
            const element = this._codeAreaRef()?.nativeElement;

            if (!element) return;

            const update = (): void => {
                this.canScrollUp.set(element.scrollTop > 1);
                this.canScrollDown.set(element.scrollTop + element.clientHeight < element.scrollHeight - 1);
            };
            const observer = new ResizeObserver(update);

            observer.observe(element);
            element.addEventListener("scroll", update, { passive: true });

            update();

            onCleanup(() => {
                observer.disconnect();
                element.removeEventListener("scroll", update);
            });
        });
    }

    // Highlighted per source line (rather than one highlighted blob for the whole code), each
    // paired with its line number. Rendering one row per entry — number + content together —
    // keeps the gutter numbers aligned with their code even when a long line wraps across
    // several visual rows: the row just grows to fit, instead of the gutter (one entry per
    // logical line) and the code (one flowing wrapped block) drifting out of sync.
    protected readonly lines: Signal<AppCodePanelLine[]> = computed<AppCodePanelLine[]>(() => {
        const language = this.prismLanguage();
        const grammar = Prism.languages[language] ?? Prism.languages["plain"];
        const text = this.code();
        const html = Prism.highlight(text, grammar, language);
        const htmlLines = this.splitHighlightedHtmlIntoLines(html);

        return htmlLines.map((lineHtml, index) => ({
            number: index + 1,
            html: lineHtml,
        }));
    });

    // Splits Prism's highlighted HTML (one blob for the *whole* source) back into per-line HTML
    // chunks, reopening/closing any `<span class="token ...">` tags that straddle a line break.
    // Prism only ever emits <span> tags (no self-closing/void elements) and HTML-escapes token
    // text, so a line never contains a literal "<" that isn't part of one of its own tags.
    private splitHighlightedHtmlIntoLines(html: string): string[] {
        const state: HighlightSplitState = { lines: [], openTags: [], current: "" };
        const tagRegex = /<\/?span[^>]*>/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = tagRegex.exec(html)) !== null) {
            this.appendHighlightedText(state, html.slice(lastIndex, match.index));

            const [tag] = match;
            const isClosingTag = tag.startsWith("</");

            if (isClosingTag) state.openTags.pop();
            if (!isClosingTag) state.openTags.push(tag);

            state.current += tag;
            lastIndex = tagRegex.lastIndex;
        }

        this.appendHighlightedText(state, html.slice(lastIndex));
        state.lines.push(state.current);

        return state.lines;
    }

    private appendHighlightedText(state: HighlightSplitState, text: string): void {
        const segments = text.split("\n");
        const lastSegmentIndex = segments.length - 1;

        segments.forEach((segment, index) => {
            state.current += segment;
            if (index === lastSegmentIndex) return;
            this.flushHighlightedLine(state);
        });
    }

    // Closes out the current line (re-closing any spans still open at the break), pushes it,
    // and starts the next line by reopening those same spans so the token styling continues.
    private flushHighlightedLine(state: HighlightSplitState): void {
        state.current += "</span>".repeat(state.openTags.length);
        state.lines.push(state.current);
        state.current = state.openTags.join("");
    }
}

