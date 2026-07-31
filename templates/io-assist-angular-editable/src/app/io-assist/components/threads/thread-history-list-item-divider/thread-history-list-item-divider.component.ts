import { CommonModule } from "@angular/common";
import { Component, input, InputSignal } from "@angular/core";

@Component({
    selector: "thread-history-list-item-divider",
    templateUrl: "./thread-history-list-item-divider.component.html",
    imports: [CommonModule],
})
export class ThreadHistoryListItemDividerComponent {
    public dividerLabel: InputSignal<string> = input<string>("");
}
