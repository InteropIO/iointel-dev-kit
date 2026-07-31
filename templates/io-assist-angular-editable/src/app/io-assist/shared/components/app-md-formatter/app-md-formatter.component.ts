import { Component, input, InputSignal } from "@angular/core";
import { HeadingComponent, PrismComponent, RemarkModule } from "ngx-remark";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { AppCopyToClipboardButtonComponent } from "../app-copy-to-clipboard-button/app-copy-to-clipboard-button.component";

// Prism core + languages
import "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";

const MODULES = [RemarkModule];
const COMPONENTS = [PrismComponent, HeadingComponent, AppCopyToClipboardButtonComponent];

@Component({
    selector: "app-md-formatter",
    templateUrl: "./app-md-formatter.component.html",
    styleUrls: ["./app-md-formatter.component.css"],
    imports: [...MODULES, ...COMPONENTS],
})
export class AppMdFormatterComponent {
    protected readonly processor = unified().use(remarkGfm).use(remarkParse);

    public readonly content: InputSignal<string> = input.required<string>();
}
