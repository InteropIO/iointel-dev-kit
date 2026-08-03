import { Component } from "@angular/core";

import { PromptListComponent } from "../prompt-list/prompt-list.component";

@Component({
    selector: "favorite-prompt-list",
    templateUrl: "./favorite-prompt-list.component.html",
    imports: [PromptListComponent],
})
export class FavoritePromptListComponent {}
