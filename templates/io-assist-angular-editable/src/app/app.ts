import { Component, signal } from "@angular/core";
import { IoAssist, type IoAssistDynamicConfig } from "./io-assist/public-api";

@Component({
    selector: "app-root",
    imports: [IoAssist],
    templateUrl: "./app.html",
    styleUrl: "./app.css",
})
export class App {
    protected readonly dynamicConfig = signal<IoAssistDynamicConfig>({
        user: {
            id: "acme-advisor",
            name: "ACME Advisor",
        },
    });
}
