import { CommonModule } from "@angular/common";
import { Component, computed, input, InputSignal, Signal, signal, WritableSignal } from "@angular/core";

import { UI_STRINGS } from "../../../../shared/constants/ui-strings";
import { UITool } from "../../../../shared/store/tool/types";

const MODULES = [CommonModule];
const TRUNCATE_LENGTH = 160;

@Component({
    selector: "tool-details",
    templateUrl: "./tool-details.component.html",
    imports: [...MODULES],
    host: { class: "flex flex-col gap-1 min-w-0 px-4 py-2 border-t border-border-default bg-[var(--app-popover-details-background)]" },
})
export class ToolDetailsComponent {
    protected readonly UI_STRINGS = UI_STRINGS.TOOL_DETAILS;

    public readonly tool: InputSignal<UITool> = input.required<UITool>();

    protected readonly isExpanded: WritableSignal<boolean> = signal<boolean>(false);

    protected readonly description: Signal<string> = computed<string>(() => this.stripToolDescriptionTags(this.tool().description));
    protected readonly truncatedDescription: Signal<string> = computed<string>(() => this.truncateToolDescription(this.description(), TRUNCATE_LENGTH));
    protected readonly canExpand: Signal<boolean> = computed<boolean>(() => this.truncatedDescription() !== this.description());
    protected readonly displayText: Signal<string> = computed<string>(() => (this.isExpanded() ? this.description() : this.truncatedDescription()));

    protected toggleExpanded(): void {
        this.isExpanded.update((expanded) => !expanded);
    }

    private stripToolDescriptionTags(description: string | undefined): string {
       const TAG_PATTERN = /<\/?[a-zA-Z][\w-]*>/g;

        return (description ?? "")
           .replace(TAG_PATTERN, " ")
           .replace(/\s+/g, " ")
           .trim();
    }

      // Truncates `text` to at most `maxLength` characters, backing up to the last whole word — never
      // splitting a word in half. Returns `text` unchanged if it already fits.
    private truncateToolDescription(text: string, maxLength: number): string {
       if (text.length <= maxLength) return text;

       const sliced = text.slice(0, maxLength);
       const lastSpaceIndex = sliced.lastIndexOf(" ");
       const wholeWords = lastSpaceIndex > 0 ? sliced.slice(0, lastSpaceIndex) : sliced;

       return `${wholeWords.trimEnd()}${'...'}`;
    }
}

