import React from "react";

import { PromptListItem } from "./PromptListItem";
import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";

export const FavoritePromptList: React.FC = () => {
    const allPrompts = useIoAssistStore((s) => s.allPrompts);
    const favoritePromptNames = useIoAssistStore((s) => s.favoritePromptNames);

    const favorites = allPrompts.filter((p) => favoritePromptNames.includes(p.name));

    if (favorites.length === 0) return null;

    return (
        <div data-testid="favorite-prompts-list" className={"flex flex-col w-full gap-[10px] py-2 max-w-[920px] w-full px-4"}>
            <div className="flex items-center p-2 w-full shrink-0">
                <span className="text-[10px] leading-[13px] tracking-[0.1px] text-text-default">{UI_STRINGS.PROMPT_LIST_COMPONENT.FAVORITE_PROMPTS}</span>
            </div>

            <div className="w-full flex flex-col md:flex-row md:flex-wrap md:justify-center gap-3">
                {favorites.map((prompt) => (
                    <PromptListItem key={prompt.name} prompt={prompt} isDisplayedInFavoriteList={true} />
                ))}
            </div>
        </div>
    );
};
