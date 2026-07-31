import React, { useMemo, useState } from "react";

import { PromptListItem } from "./PromptListItem";
import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";
import type { Prompt } from "../../types";
import { SearchInput } from "../shared/SearchInput";

const DOCS_URL = "https://docs-ai.interop.io/";
const UNCATEGORIZED_CATEGORY_NAME = "Default Prompts";

type PromptGroup = {
    category: string;
    prompts: Prompt[];
};

type Props = {
    className?: string;
};

const sortPromptsAlphabetically = (prompts: Prompt[]): Prompt[] => [...prompts].sort((a, b) => a.name.localeCompare(b.name));

export const PromptListPanel: React.FC<Props> = ({ className }) => {
    const allPrompts = useIoAssistStore((s) => s.allPrompts);

    const [search, setSearch] = useState("");

    const hasAnyPrompts = allPrompts.length > 0;

    const filteredPrompts = useMemo<Prompt[]>(() => {
        const lower = search.trim().toLowerCase();
        if (!lower) return allPrompts;
        return allPrompts.filter((p) => p.name.toLowerCase().includes(lower));
    }, [allPrompts, search]);

    const promptGroups = useMemo<PromptGroup[]>(() => {
        const categoryMap = new Map<string, Prompt[]>();
        for (const prompt of filteredPrompts) {
            const category = prompt.category || UNCATEGORIZED_CATEGORY_NAME;
            const existing = categoryMap.get(category) || [];
            categoryMap.set(category, [...existing, prompt]);
        }

        const groups: PromptGroup[] = Array.from(categoryMap.entries()).map(([category, prompts]) => ({
            category,
            prompts: sortPromptsAlphabetically(prompts),
        }));

        return groups.sort((a, b) => {
            if (a.category === UNCATEGORIZED_CATEGORY_NAME) return 1;
            if (b.category === UNCATEGORIZED_CATEGORY_NAME) return -1;
            return a.category.localeCompare(b.category);
        });
    }, [filteredPrompts]);

    const noFilteredPrompts = filteredPrompts.length === 0;

    const onDocsLinkClick = (): void => {
        window.open(DOCS_URL, "_blank", "noopener,noreferrer");
    };

    return (
        <div data-testid="prompt-panel" className={["flex flex-col w-full", className ?? ""].filter(Boolean).join(" ")}>
            {hasAnyPrompts && <SearchInput value={search} onChange={setSearch} placeholder={UI_STRINGS.PROMPT_LIST_COMPONENT.INPUT_TOOLTIP} testId="prompt-filter-input" />}

            <div className="flex flex-col w-full gap-[10px] py-2 min-h-0">
                {!hasAnyPrompts && (
                    <div className="flex justify-center items-center h-16">
                        <div className="flex flex-col items-center gap-2 text-center px-4">
                            <span className="text-text-default">{UI_STRINGS.PROMPT_LIST_COMPONENT.NO_PROMPTS_CONFIGURED}</span>
                            <button type="button" className="text-xs text-blue-500 hover:text-blue-600 underline cursor-pointer" onClick={onDocsLinkClick}>
                                {UI_STRINGS.PROMPT_LIST_COMPONENT.NO_PROMPTS_SEE_MORE}
                            </button>
                        </div>
                    </div>
                )}

                {hasAnyPrompts && noFilteredPrompts && (
                    <div className="flex justify-center items-center h-16">
                        <span className="text-text-default">{UI_STRINGS.PROMPT_LIST_COMPONENT.NO_PROMPTS}</span>
                    </div>
                )}

                {!noFilteredPrompts && (
                    <div className="w-full min-h-0 flex flex-col gap-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {promptGroups.map((group) => (
                            <React.Fragment key={group.category}>
                                <div className="flex items-center px-2 py-1 mb-1">
                                    <span data-testid="prompt-category" className="text-[10px] font-normal text-text-default leading-[13px] tracking-[0.1px]">
                                        {group.category}
                                    </span>
                                </div>
                                {group.prompts.map((prompt) => (
                                    <PromptListItem key={prompt.name} prompt={prompt} isDisplayedInFavoriteList={false} />
                                ))}
                            </React.Fragment>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
