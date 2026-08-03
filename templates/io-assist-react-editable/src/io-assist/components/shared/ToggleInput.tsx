import React from "react";

import { Icon } from "./Icon";
import { CheckIcon, CloseIcon } from "./icons";

type Props = {
    isChecked: boolean;
    onToggle: () => void;
    isDisabled?: boolean;
    testId?: string;
};

// Matches ng app-toggle: 34x16 track with sliding 12x12 circle and a check/close
// icon in the opposite half.
export const ToggleInput: React.FC<Props> = ({ isChecked, onToggle, isDisabled = false, testId }) => {
    const toggleSwitch = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isDisabled) onToggle();
    };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isDisabled) return;
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onToggle();
        }
    };

    return (
        <div
            role="switch"
            data-testid={testId}
            aria-checked={isChecked}
            aria-disabled={isDisabled}
            tabIndex={isDisabled ? -1 : 0}
            onClick={toggleSwitch}
            onKeyDown={handleKeyDown}
            className={[
                "relative inline-flex items-center w-[34px] h-[16px] rounded-full transition-colors duration-300 ease-in-out",
                isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                !isChecked && !isDisabled ? "hover:bg-toggle-background-hover-disabled" : "",
                isChecked && !isDisabled ? "hover:bg-toggle-background-hover-enabled" : "",
                isChecked ? "bg-toggle-background-enabled" : "bg-toggle-background-disabled",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className={["flex flex-1 transition-all duration-300", isChecked ? "justify-start" : "justify-end"].join(" ")}>
                <span className="m-[4px] inline-flex items-center justify-center text-text-states-active">
                    <Icon size={10}>{isChecked ? <CheckIcon /> : <CloseIcon />}</Icon>
                </span>
            </div>

            <div className={["absolute w-[12px] h-[12px] bg-toggle-circle rounded-full transition-all duration-300 ease-in-out", isChecked ? "left-[20px]" : "left-[2px]"].join(" ")} />
        </div>
    );
};
