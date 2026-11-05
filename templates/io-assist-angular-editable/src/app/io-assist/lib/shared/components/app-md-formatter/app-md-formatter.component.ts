import { Component, input, InputSignal } from "@angular/core";
import { HeadingComponent, RemarkModule } from "ngx-remark";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { AppCodePanelComponent } from "../app-code-panel/app-code-panel.component";

// Prism core + languages
import "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";

// Display names for common fenced-code languages; anything else is shown capitalized.
const LANGUAGE_LABELS: Record<string, string> = {
    js: "JavaScript",
    javascript: "JavaScript",
    ts: "TypeScript",
    typescript: "TypeScript",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    xml: "XML",
    md: "Markdown",
    markdown: "Markdown",
};

const MODULES = [RemarkModule];
const COMPONENTS = [HeadingComponent, AppCodePanelComponent];

@Component({
    selector: "app-md-formatter",
    templateUrl: "./app-md-formatter.component.html",
    styleUrls: ["./app-md-formatter.component.css"],
    imports: [...MODULES, ...COMPONENTS],
})
export class AppMdFormatterComponent {
    protected readonly processor = unified().use(remarkGfm).use(remarkParse);

    public readonly content: InputSignal<string> = input.required<string>();

    protected languageLabel(lang: string | null | undefined): string {
        const key = (lang ?? "").trim().toLowerCase();

        if (!key) return "Text";

        return LANGUAGE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
    }
}
