import React, { useState } from "react";

import { useIoAssistStore } from "../../context/IoAssistContext";
import { useIoConnectApi } from "../../hooks/useIoConnectApi";
import type { Prompt } from "../../types";
import { Icon } from "../shared/Icon";
import { PromptDotIcon, StarIcon, StarFilledIcon } from "../shared/icons";

type Props = {
    prompt: Prompt;
    isDisplayedInFavoriteList: boolean;
};

export const PromptListItem: React.FC<Props> = ({ prompt, isDisplayedInFavoriteList }) => {
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
        "flex w-full",
        isDisplayedInFavoriteList ? "md:w-auto md:max-w-[352px] md:min-w-[250px] border border-border-default hover:border-border-hover rounded-2xl bg-app-background-secondary" : "",
    ]
        .filter(Boolean)
        .join(" ");

    const rowClasses = [
        "flex flex-1 justify-between items-center p-2 gap-2 cursor-pointer min-w-0",
        isDisplayedInFavoriteList ? "h-[48px] rounded-2xl" : ["rounded-md", isHovered ? "bg-app-background-secondary" : ""].filter(Boolean).join(" "),
    ].join(" ");

    return (
        <div data-testid="prompt-list-item" data-prompt-name={prompt.name} className={hostClasses} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <div
                role="button"
                tabIndex={0}
                className={rowClasses}
                onClick={handleSelect}
                onKeyUp={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleSelect();
                }}
                title={prompt.description || undefined}
            >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-default">
                    <Icon size={16}>
                        <PromptDotIcon />
                    </Icon>
                </span>

                <span className={["flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs", isHovered ? "text-text-states-hover" : "text-text-default"].join(" ")}>{prompt.name}</span>

                <button
                    type="button"
                    data-testid="prompt-favorite-button"
                    aria-pressed={isFavorite}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    className={[
                        "p-2 ps-1 shrink-0 inline-flex items-center justify-center cursor-pointer bg-transparent border-0",
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
