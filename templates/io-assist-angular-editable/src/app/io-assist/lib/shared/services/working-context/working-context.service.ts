import { inject, Injectable } from "@angular/core";
import { IoIntelWorkingContext } from "@interopio/working-context";

import { IOAiWebService } from "../io-ai-web/io-ai-web.service";

@Injectable({
    providedIn: "root",
})
export class WorkingContextService {
    private readonly _ioIntelWebService: IOAiWebService = inject(IOAiWebService);

    public getWorkingContext(): Promise<Record<string, IoIntelWorkingContext.Property>> {
        return this._ioIntelWebService.getWorkingContext();
    }

    public onWorkingContextChange(callback: (workingContext: Record<string, IoIntelWorkingContext.Property>) => void): IoIntelWorkingContext.UnsubscribeFunction {
        return this._ioIntelWebService.onWorkingContextChange(callback);
    }

    public isWorkingContextEnabled(): Promise<boolean> {
        return Promise.resolve(this._ioIntelWebService.isWorkingContextEnabled());
    }
}
