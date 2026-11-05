import React from "react";

import { Icon } from "./Icon";

type IconButtonVariant = "default" | "danger" | "plain";
// "rounded-square" corners at 25% of the button (8px on 32px buttons, 6px on 24px ones) —
// the default hover shape for toolbar/content icon buttons (mirrors ng's app-icon default).
type IconButtonShape = "circle" | "rounded-rectangle" | "rounded-square";

type IconButtonProps = {
    size?: number;
    containerSize?: number;
    testId?: string;
    variant?: IconButtonVariant;
    shape?: IconButtonShape;
    /** Translucent `--app-icon-button-hover` background fill on hover. */
    hoverFill?: boolean;
    /** Translucent `--app-icon-button-selected` background fill, e.g. while a panel it opens is open. */
    selected?: boolean;
    children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

const ICON_BUTTON_HOVER_BY_VARIANT: Record<IconButtonVariant, string> = {
    default: "hover:text-icon-hover",
    danger: "hover:text-app-danger",
    // No hover color change — for buttons that animate/keep their color on hover
    // (e.g. ng's panel/modal close icon keeps `--app-text-black-white`).
    plain: "",
};

const ICON_BUTTON_SHAPE_CLASS: Record<IconButtonShape, string> = {
    circle: "rounded-full",
    "rounded-rectangle": "rounded-lg",
    "rounded-square": "rounded-[25%]",
};

export const IconButton: React.FC<IconButtonProps> = ({
    size = 16,
    containerSize,
    className,
    testId,
    style,
    type = "button",
    variant = "default",
    shape = "circle",
    hoverFill = false,
    selected = false,
    disabled = false,
    children,
    ...rest
}) => (
    <button
        type={type}
        data-testid={testId}
        className={[
            "flex items-center justify-center cursor-pointer transition-colors text-icon-default disabled:text-icon-disabled disabled:cursor-not-allowed",
            ICON_BUTTON_SHAPE_CLASS[shape],
            ICON_BUTTON_HOVER_BY_VARIANT[variant],
            selected ? "bg-icon-button-selected hover:bg-icon-button-selected" : hoverFill ? "hover:bg-icon-button-hover" : "",
            className ?? "",
        ].join(" ")}
        style={{
            ...(containerSize ? { width: `${containerSize}px`, height: `${containerSize}px` } : null),
            ...style,
        }}
        disabled={disabled}
        {...rest}
    >
        {/* `disabled` is forwarded to the wrapper as well as the button: ng puts the
            cursor-pointer / cursor-not-allowed pair on the `app-icon` `.icon-wrapper` host. */}
        <Icon size={size} disabled={disabled}>
            {children}
        </Icon>
    </button>
);
