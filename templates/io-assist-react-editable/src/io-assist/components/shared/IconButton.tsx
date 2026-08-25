import React from "react";

import { Icon } from "./Icon";

type IconButtonVariant = "default" | "danger" | "plain";
type IconButtonShape = "circle" | "rounded-rectangle";

type IconButtonProps = {
    size?: number;
    containerSize?: number;
    testId?: string;
    variant?: IconButtonVariant;
    shape?: IconButtonShape;
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
};

export const IconButton: React.FC<IconButtonProps> = ({ size = 16, containerSize, className, testId, style, type = "button", variant = "default", shape = "circle", children, ...rest }) => (
    <button
        type={type}
        data-testid={testId}
        className={[
            "flex items-center justify-center cursor-pointer transition-colors text-icon-default disabled:text-icon-disabled disabled:cursor-not-allowed",
            ICON_BUTTON_SHAPE_CLASS[shape],
            ICON_BUTTON_HOVER_BY_VARIANT[variant],
            className ?? "",
        ].join(" ")}
        style={{
            ...(containerSize ? { width: `${containerSize}px`, height: `${containerSize}px` } : null),
            ...style,
        }}
        {...rest}
    >
        <Icon size={size}>{children}</Icon>
    </button>
);
