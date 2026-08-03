import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "./Icon";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "./icons";
import type { SelectOption } from "../../types/select";

const PLACEHOLDER = "Select...";

type Props<TValue> = {
    /** Unique id for this select instance — used for aria wiring. */
    selectId: string;
    options: SelectOption<TValue>[];
    value: TValue;
    onChange: (option: SelectOption<TValue>) => void;
    label?: string;
    /** Show border outline on trigger; when false (default) uses solid-bg design. */
    outline?: boolean;
    /** Place the check icon left and the item icon right. */
    invertOrder?: boolean;
    /** Preferred dropdown direction; flips when there is not enough space. */
    preferredPlacement?: "above" | "below";
};

/**
 * Styled select trigger + dropdown. React port of ng's AppSelectComponent —
 * controlled (the selected value lives in the caller's state), fixed-positioned
 * dropdown with viewport flip, keyboard navigation and click-outside close.
 */
export function Select<TValue>({ selectId, options, value, onChange, label, outline = false, invertOrder = false, preferredPlacement = "below" }: Props<TValue>): React.ReactElement {
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [isTriggerFocused, setIsTriggerFocused] = useState(false);
    const lastInputWasPointer = useRef(false);

    const selected = useMemo(() => options.find((o) => String(o.value) === String(value)) ?? null, [options, value]);

    const displayTitle = selected ? (selected.miniTitle ?? selected.title) : PLACEHOLDER;
    const hasAnyIcon = options.some((o) => o.icon !== undefined);

    const isSelected = useCallback((option: SelectOption<TValue>) => String(option.value) === String(value), [value]);

    const updateDropdownPosition = useCallback(() => {
        const triggerEl = triggerRef.current;
        const dropdownEl = dropdownRef.current;
        if (!triggerEl || !dropdownEl) return;

        const triggerRect = triggerEl.getBoundingClientRect();
        const dropdownHeight = dropdownEl.offsetHeight;
        const dropdownWidth = dropdownEl.offsetWidth;
        const spaceBelow = window.innerHeight - triggerRect.bottom - 8;
        const spaceAbove = triggerRect.top - 8;

        const preferAbove = preferredPlacement === "above";
        const openUpward = preferAbove ? spaceAbove >= dropdownHeight || spaceAbove > spaceBelow : spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

        const left = Math.max(8, Math.min(triggerRect.left, window.innerWidth - dropdownWidth - 8));

        setDropdownStyle({
            left: `${left}px`,
            minWidth: `${triggerRect.width}px`,
            ...(openUpward ? { bottom: `${window.innerHeight - triggerRect.top + 4}px`, top: "auto" } : { top: `${triggerRect.bottom + 4}px`, bottom: "auto" }),
        });
    }, [preferredPlacement]);

    const toggle = () => {
        setIsOpen((open) => {
            const next = !open;
            if (next) {
                setFocusedIndex(-1);
                requestAnimationFrame(() => updateDropdownPosition());
            }
            return next;
        });
    };

    const handleTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        toggle();
    };

    const select = (option: SelectOption<TValue>) => {
        onChange(option);
        setIsOpen(false);
    };

    const scrollFocusedIntoView = useCallback(() => {
        const dropdownEl = dropdownRef.current;
        if (!dropdownEl) return;
        const items = dropdownEl.querySelectorAll<HTMLElement>('[role="option"]');
        items[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }, [focusedIndex]);

    useEffect(() => {
        if (!isOpen) return;

        const onReposition = () => requestAnimationFrame(() => updateDropdownPosition());
        const onDocumentClick = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        };
        const onKeydown = (event: KeyboardEvent) => {
            const last = options.length - 1;
            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    setFocusedIndex((i) => Math.min(i + 1, last));
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    setFocusedIndex((i) => Math.max(i - 1, 0));
                    break;
                case "Home":
                    event.preventDefault();
                    setFocusedIndex(0);
                    break;
                case "End":
                    event.preventDefault();
                    setFocusedIndex(last);
                    break;
                case "Enter": {
                    event.preventDefault();
                    setFocusedIndex((idx) => {
                        if (idx >= 0 && options[idx]) select(options[idx]);
                        return idx;
                    });
                    break;
                }
                case "Escape":
                    setIsOpen(false);
                    break;
            }
        };

        window.addEventListener("resize", onReposition);
        window.addEventListener("scroll", onReposition, true);
        document.addEventListener("click", onDocumentClick);
        document.addEventListener("keydown", onKeydown);
        return () => {
            window.removeEventListener("resize", onReposition);
            window.removeEventListener("scroll", onReposition, true);
            document.removeEventListener("click", onDocumentClick);
            document.removeEventListener("keydown", onKeydown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, options, updateDropdownPosition]);

    useEffect(() => {
        if (isOpen) scrollFocusedIntoView();
    }, [focusedIndex, isOpen, scrollFocusedIntoView]);

    const triggerActive = isOpen || isTriggerFocused;

    return (
        <div ref={rootRef} className="relative flex flex-col gap-spacing-2">
            {label && <span className="text-[10px] text-text-secondary leading-[13px]">{label}</span>}

            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={`${selectId}-listbox`}
                className={[
                    "flex items-center gap-spacing-2 py-spacing-4 px-spacing-4 rounded-[8px] text-input-text text-[12px] leading-none cursor-pointer w-full transition-colors outline-none hover:text-text-states-active",
                    triggerActive ? "text-text-states-active" : "",
                    !outline && triggerActive ? "bg-thread-list-item-hover-background" : "",
                    !outline && !triggerActive ? "bg-transparent hover:bg-thread-list-item-hover-background" : "",
                    outline ? "border border-border-default" : "",
                ]
                    .filter(Boolean)
                    .join(" ")}
                onPointerDown={() => (lastInputWasPointer.current = true)}
                onFocus={() => {
                    if (!lastInputWasPointer.current) setIsTriggerFocused(true);
                    lastInputWasPointer.current = false;
                }}
                onBlur={() => setIsTriggerFocused(false)}
                onClick={handleTriggerClick}
            >
                <span className="flex-1 truncate text-left">{displayTitle}</span>
                <span className="flex justify-center items-center w-[10px] h-[10px] shrink-0">
                    <Icon size={10}>{isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}</Icon>
                </span>
            </button>

            {isOpen && (
                <div
                    ref={dropdownRef}
                    role="listbox"
                    id={`${selectId}-listbox`}
                    className="app-select__dropdown fixed z-[999999] flex flex-col bg-app-background-secondary border border-border-default rounded-[8px] shadow-panel-box-shadow w-max max-h-[45vh] overflow-y-auto py-[3px] gap-[1px]"
                    style={dropdownStyle}
                >
                    {options.map((option, i) => (
                        <div
                            key={String(option.value ?? option.title)}
                            role="option"
                            aria-selected={isSelected(option)}
                            tabIndex={0}
                            id={`${selectId}-opt-${i}`}
                            className="flex items-center w-full px-1 py-px cursor-pointer"
                            onClick={() => select(option)}
                            onKeyUp={(e) => e.key === "Enter" && select(option)}
                        >
                            <div
                                className="group flex items-center gap-1 w-full p-1 rounded-[4px] transition-colors hover:bg-[var(--app-blue)]"
                                style={focusedIndex === i ? { backgroundColor: "var(--app-blue)" } : undefined}
                            >
                                {hasAnyIcon && (
                                    <div className={["w-4 shrink-0 flex items-center justify-center text-white", invertOrder ? "order-last" : ""].join(" ")}>
                                        {option.icon && <Icon size={10}>{option.icon}</Icon>}
                                    </div>
                                )}

                                <div className="flex-1 flex flex-col gap-0 min-w-0">
                                    <span className="truncate text-xs font-normal leading-4 text-input-text group-hover:text-white" title={option.title}>
                                        {option.title}
                                    </span>

                                    {option.description && (
                                        <span
                                            className="truncate text-[9px] font-normal leading-[11px] tracking-[0.09px] text-text-secondary group-hover:text-[var(--app-light-blue)]"
                                            title={option.description}
                                        >
                                            {option.description}
                                        </span>
                                    )}
                                </div>

                                <div className={["w-4 h-4 shrink-0 flex items-center justify-center text-white", invertOrder ? "order-first" : ""].join(" ")}>
                                    {isSelected(option) && (
                                        <Icon size={10}>
                                            <CheckIcon />
                                        </Icon>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
