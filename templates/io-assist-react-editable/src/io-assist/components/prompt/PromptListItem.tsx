import React, { useState } from "react";

import { useIoAssistStore } from "../../context/IoAssistContext";
import { useIoConnectApi } from "../../hooks/useIoConnectApi";
import type { IconResource, Prompt } from "../../types";
import { Icon } from "../shared/Icon";
import { PromptPanelIcon, StarIcon, StarFilledIcon } from "../shared/icons";

type Props = {
    prompt: Prompt;
    isDisplayedInFavoriteList: boolean;
};

const getIconMaskUrl = (iconResource: IconResource): string => {
    if (iconResource.type === "svg") {
        return `url(${JSON.stringify(`data:image/svg+xml,${encodeURIComponent(iconResource.data)}`)})`;
    }

    return `url(${JSON.stringify(iconResource.data)})`;
};

const PromptItemIcon: React.FC<{ iconResource?: IconResource }> = ({ iconResource }) => {
    if (!iconResource) {
        return (
            <Icon size={12}>
                <PromptPanelIcon />
            </Icon>
        );
    }

    const maskImage = getIconMaskUrl(iconResource);

    return (
        <span
            aria-hidden="true"
            className="block size-3 bg-current"
            style={{
                WebkitMaskImage: maskImage,
                maskImage,
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
            }}
        />
    );
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
                <span data-testid="prompt-icon" className={["flex size-6 shrink-0 items-center justify-center", isHovered ? "text-text-states-hover" : "text-text-default"].join(" ")}>
                    <PromptItemIcon iconResource={prompt.iconResource} />
                </span>

                <span className={["flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs", isHovered ? "text-text-states-hover" : "text-text-default"].join(" ")}>{prompt.name}</span>

                <button
                    type="button"
                    data-testid="prompt-favorite-button"
                    aria-pressed={isFavorite}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
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
