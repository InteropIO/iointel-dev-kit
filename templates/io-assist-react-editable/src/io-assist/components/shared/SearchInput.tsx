import React, { useState } from "react";

import { Icon } from "./Icon";
import { SearchIcon, CloseIcon } from "./icons";

type Props = {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    testId?: string;
};

// Sticky search input — visual parity with ng app-input (search variant): a
// bordered cell with leading search icon, trailing clear-X (only when filled),
// and hover / focus-within state swaps on bg + border.
export const SearchInput: React.FC<Props> = ({ value, onChange, placeholder, testId }) => {
    const [isActive, setIsActive] = useState(false);
    const hasValue = value.length > 0;

    return (
        <div className="sticky top-0 z-10 bg-panel-background pb-1">
            <div
                className={[
                    "flex flex-col items-start justify-center w-full p-2 mb-1 rounded-input-radius border",
                    "bg-input-background border-input-border",
                    !isActive && "hover:bg-input-background-hover hover:border-input-border-hover",
                    isActive && "bg-input-background-active border-input-border-active",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <div className="flex gap-2 items-center w-full">
                    <span className={["inline-flex items-center justify-center", isActive ? "text-input-icon-active" : "text-input-icon"].join(" ")}>
                        <Icon size={12}>
                            <SearchIcon />
                        </Icon>
                    </span>

                    <input
                        type="text"
                        data-testid={testId}
                        aria-label={placeholder}
                        className={["flex-1 min-w-0 bg-transparent border-0 outline-none text-xs", isActive ? "text-input-text-active" : "text-input-text"].join(" ")}
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onFocus={() => setIsActive(true)}
                        onBlur={() => setIsActive(false)}
                    />

                    {hasValue && (
                        <button
                            type="button"
                            className={["inline-flex items-center justify-center cursor-pointer", isActive ? "text-input-icon-active" : "text-input-icon"].join(" ")}
                            onClick={() => onChange("")}
                            aria-label="Clear search"
                        >
                            <Icon size={12}>
                                <CloseIcon />
                            </Icon>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
