import type { ReactNode } from "react";

/**
 * A single option for the `Select` component. Mirrors ng's `AppSelectOption`,
 * but `icon` is a rendered React node (React has no icon-variant registry).
 */
export type SelectOption<TValue = unknown> = {
    title: string;
    /** Compact label shown on the trigger when selected (falls back to `title`). */
    miniTitle?: string;
    description?: string;
    icon?: ReactNode;
    isSelected?: boolean;
    value: TValue;
};
