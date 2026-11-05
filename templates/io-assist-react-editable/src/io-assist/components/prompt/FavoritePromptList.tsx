import React from "react";

import { PromptListItem } from "./PromptListItem";
import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";
import type { Prompt } from "../../types";

export const FavoritePromptList: React.FC = () => {
    const allPrompts = useIoAssistStore((s) => s.allPrompts);
    const favoritePromptNames = useIoAssistStore((s) => s.favoritePromptNames);

    const favorites = favoritePromptNames.map((name) => allPrompts.find((p) => p.name === name)).filter((p): p is Prompt => p !== undefined);

    if (favorites.length === 0) return null;

    return (
        <div data-testid="favorite-prompts-list" className={"flex flex-col w-full gap-[10px] py-2 max-w-[920px] md:max-w-[720px] px-4"}>
            <div className="flex items-center px-[2px] w-full shrink-0">
                <span data-testid="favorite-prompts-header" className="text-[10px] leading-[13px] tracking-[0.1px] text-text-default">{UI_STRINGS.PROMPT_LIST_COMPONENT.FAVORITE_PROMPTS}</span>
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {favorites.map((prompt) => (
                    <PromptListItem key={prompt.name} prompt={prompt} isDisplayedInFavoriteList={true} />
                ))}
            </div>
        </div>
    );
};
