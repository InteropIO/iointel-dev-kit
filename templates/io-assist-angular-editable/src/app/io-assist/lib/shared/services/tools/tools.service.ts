import { inject, Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";

import { UITool } from "../../store/tool/types";
import { IOAiWebService } from "../io-ai-web/io-ai-web.service";

@Injectable({
    providedIn: "root",
})
export class ToolsService {
    private _ioIntelWebService: IOAiWebService = inject(IOAiWebService);

    public fetchTools(): Promise<IoAiWeb.Tools.Tool[]> {
        return this._ioIntelWebService.listTools();
    }

    public toggleTool(tool: UITool): Promise<IoAiWeb.Tools.Tool> {
        return this._ioIntelWebService.toggleTool(tool.name, !tool.enabled);
    }

    // TODO: subscribe to tool updates tools/update
}
