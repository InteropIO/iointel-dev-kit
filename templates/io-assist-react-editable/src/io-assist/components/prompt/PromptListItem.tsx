import React, { useState } from "react";

import { useIoAssistStore } from "../../context/IoAssistContext";
import { useIoConnectApi } from "../../hooks/useIoConnectApi";
import type { Prompt } from "../../types";
import { Icon } from "../shared/Icon";
import { StarIcon, StarFilledIcon } from "../shared/icons";

type Props = {
    prompt: Prompt;
    isDisplayedInFavoriteList: boolean;
    className?: string;
};

export const PromptListItem: React.FC<Props> = ({ prompt, isDisplayedInFavoriteList, className }) => {
    const [isHovered, setIsHovered] = useState(false);
    const favoritePromptNames = useIoAssistStore((s) => s.favoritePromptNames);
    const setSelectedPrompt = useIoAssistStore((s) => s.setSelectedPrompt);
    const setActivePanelContent = useIoAssistStore((s) => s.setActivePanelContent);
    const { toggleFavoritePrompt } = useIoConnectApi();

    const isFavorite = favoritePromptNames.includes(prompt.name);

    const handleSelect = () => {
        setSelectedPrompt({ id: prompt.id, name: prompt.name, description: prompt.description });
        if (!isDisplayedInFavoriteList) {
            setActivePanelContent(null);
        }
    };

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        void toggleFavoritePrompt(prompt.name);
    };

    const hostClasses = [
        "flex w-full min-w-0",
        isDisplayedInFavoriteList ? "border border-border-default hover:border-border-hover rounded-xl" : "",
        className ?? "",
    ]
        .filter(Boolean)
        .join(" ");

    const rowClasses = [
        "flex flex-1 justify-between items-center gap-2 cursor-pointer min-w-0 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--app-focus-ring)]",
        isDisplayedInFavoriteList
            ? ["pl-3 pr-[5px] h-10 rounded-xl", isHovered ? "shadow-[0_0.5px_0.5px_0.5px_rgba(0,0,0,0.15)]" : ""].filter(Boolean).join(" ")
            : ["min-h-[36px] pl-[14px] pr-[7px]", isHovered ? "bg-app-background-secondary" : ""].filter(Boolean).join(" "),
    ].join(" ");

    return (
        <div className={hostClasses} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <div
                data-testid="prompt-list-item"
                data-prompt-name={prompt.name}
                role="button"
                tabIndex={0}
                className={rowClasses}
                onClick={handleSelect}
                onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter") handleSelect();
                    if (e.key === " ") {
                        e.preventDefault();
                        handleSelect();
                    }
                }}
                title={prompt.description || undefined}
            >
                <span
                    className={[
                        "flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
                        isDisplayedInFavoriteList ? "text-xs" : "text-[13px]",
                        isHovered ? "text-text-states-hover" : "text-text-default",
                    ].join(" ")}
                >
                    {prompt.name}
                </span>

                <button
                    type="button"
                    data-testid="prompt-favorite-button"
                    aria-pressed={isFavorite}
                    aria-label={isFavorite ? "Remove From Favorites" : "Add To Favorites"}
                    title={isFavorite ? "Remove From Favorites" : "Add To Favorites"}
                    className={[
                        "size-6 p-2 ps-1 shrink-0 inline-flex items-center justify-center cursor-pointer bg-transparent border-0",
                        isFavorite ? "text-yellow-400" : isHovered ? "text-text-default hover:text-yellow-400" : "text-text-states-disabled",
                    ].join(" ")}
                    onClick={handleToggleFavorite}
                >
                    <Icon size={12}>{isFavorite ? <StarFilledIcon /> : <StarIcon filled={false} />}</Icon>
                </button>
            </div>
        </div>
    );
};
