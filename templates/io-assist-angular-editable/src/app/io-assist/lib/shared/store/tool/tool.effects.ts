import { inject, Injectable } from "@angular/core";
import { IoAiWeb } from "@interopio/ai-web";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { mergeMap, map, of, catchError, from, switchMap } from "rxjs";

import { USER_TOOL_STATE } from "./enums";
import { fetchTools, fetchToolsFailure, fetchToolsSuccess, toggleTool, toggleToolFailure, toggleToolSuccess } from "./tool.actions";
import { UITool } from "./types";
import { ToolsService } from "../../services/tools/tools.service";

@Injectable()
export class ToolEffects {
    private _actions$: Actions = inject(Actions);
    private _toolsService: ToolsService = inject(ToolsService);

    fetchTools$ = createEffect(() => {
        return this._actions$.pipe(
            ofType(fetchTools),
            mergeMap(() =>
                from(this._toolsService.fetchTools()).pipe(
                    map((tools: IoAiWeb.Tools.Tool[]) => {
                        const uiTools: UITool[] = tools.map((tool) => ({
                            ...tool,
                            state: USER_TOOL_STATE.IDLE,
                        }));

                        return fetchToolsSuccess({ tools: uiTools });
                    }),
                    catchError((error) =>
                        of(
                            fetchToolsFailure({
                                error: error instanceof Error ? error : new Error(String(error)),
                            })
                        )
                    )
                )
            )
        );
    });

    toggleTool$ = createEffect(() => {
        return this._actions$.pipe(
            ofType(toggleTool),
            switchMap(({ tool }) => {
                return from(this._toolsService.toggleTool(tool)).pipe(
                    map((updatedTool: IoAiWeb.Tools.Tool) => {
                        const uiTool: UITool = {
                            ...updatedTool,
                            state: USER_TOOL_STATE.IDLE,
                        };

                        return toggleToolSuccess({ tool: uiTool });
                    }),
                    catchError((error) =>
                        of(
                            toggleToolFailure({
                                error: error instanceof Error ? error : new Error(String(error)),
                                tool,
                            })
                        )
                    )
                );
            })
        );
    });
}
