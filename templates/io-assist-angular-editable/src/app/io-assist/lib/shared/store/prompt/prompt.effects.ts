import { inject, Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Store } from "@ngrx/store";
import { mergeMap, map, of, catchError, from, forkJoin, EMPTY } from "rxjs";

import { parsePromptsConfig, parsePromptsConfigSuccess, selectPrompt, togglePromptFavorite } from "./prompt.actions";
import { selectAllPrompts, selectFavoritePromptNames } from "./prompt.selector";
import { UI_PREFS_KEYS } from "../../constants/ui-prefs-keys";
import { IOConnectService } from "../../services/io/io.service";
import { LoggerService } from "../../services/logger/logger.service";
import { OverlayService } from "../../services/overlay/overlay.service";
import { PromptService } from "../../services/prompt/prompt.service";
import { UIPrompt } from "../../services/prompt/types";

@Injectable()
export class PromptEffects {
    private _actions$: Actions = inject(Actions);
    private _promptService: PromptService = inject(PromptService);
    private _ioService: IOConnectService = inject(IOConnectService);
    private _overlayService: OverlayService = inject(OverlayService);
    private _store: Store = inject(Store);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "PromptEffects";

    private _promptState = this._store.selectSignal(selectAllPrompts);
    private _favoritePromptNames = this._store.selectSignal(selectFavoritePromptNames);

    parsePromptsConfig$ = createEffect(() => {
        return this._actions$.pipe(
            ofType(parsePromptsConfig),
            mergeMap(() => {
                // Fetch config prompts synchronously
                const configPrompts: UIPrompt[] = this._promptService.mapConfigPromptsToUIPrompts();

                // Fetch user-defined prompts and favorites from prefs
                return forkJoin({
                    promptsFromPrefs: from(this._ioService.fetchPrefs<UIPrompt[]>(UI_PREFS_KEYS.PROMPTS)).pipe(catchError(() => of(null))),
                    favoritePromptNames: from(this._ioService.fetchPrefs<string[]>(UI_PREFS_KEYS.FAVORITE_PROMPTS) as Promise<string[]>).pipe(catchError(() => of([] as string[]))),
                }).pipe(
                    map(({ promptsFromPrefs, favoritePromptNames }) => {
                        const combinedPrompts: UIPrompt[] = [...configPrompts, ...(promptsFromPrefs ?? [])];

                        return parsePromptsConfigSuccess({
                            prompts: combinedPrompts,
                            favorites: favoritePromptNames ? favoritePromptNames : [],
                        });
                    })
                );
            })
        );
    });

    syncFavoritePromptsInPrefs$ = createEffect(
        () =>
            this._actions$.pipe(
                ofType(togglePromptFavorite),
                mergeMap(() => {
                    return from(this._ioService.updatePrefs(UI_PREFS_KEYS.FAVORITE_PROMPTS, this._favoritePromptNames())).pipe(
                        catchError((error) => {
                            this._logger.get(this.LOGGER_NAME).error(`Failed to sync prefs: ${error instanceof Error ? error.message : String(error)}`);
                            return EMPTY;
                        })
                    );
                })
            ),
        { dispatch: false }
    );

    closeOverlayOnPromptSelect$ = createEffect(
        () =>
            this._actions$.pipe(
                ofType(selectPrompt),
                map(() => {
                    this._overlayService.closeCurrentOverlay();
                })
            ),
        { dispatch: false }
    );
}
