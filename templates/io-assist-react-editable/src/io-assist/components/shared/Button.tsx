import React from "react";

// Mirrors ng's app-button component.
export type ButtonType = "default" | "submit" | "danger" | "secondary";
/** "small" = 24px tall (e.g. header), "default" = 36px. */
export type ButtonSize = "default" | "small";

type ButtonProps = {
    buttonType?: ButtonType;
    size?: ButtonSize;
    testId?: string;
    children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type">;

const SIZE_CLASS: Record<ButtonSize, string> = {
    default: "px-4 py-2 text-[12px]",
    small: "px-[10px] py-[3px] text-[12px] leading-4",
};

// Gradient-sheen pseudo-element border highlight shared by the solid (submit/danger) variants.
const SHEEN_CLASS =
    "relative z-0 border-0 text-white before:content-[''] before:absolute before:inset-0 before:z-[-1] before:rounded-[inherit] before:p-px " +
    "before:[background:linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0)_100%)] " +
    "before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] " +
    "before:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[mask-composite:exclude] before:pointer-events-none";

const TYPE_CLASS: Record<ButtonType, string> = {
    submit: `${SHEEN_CLASS} bg-button-submit-background hover:bg-[color-mix(in_srgb,var(--app-blue)_85%,black_15%)]`,
    danger: `${SHEEN_CLASS} bg-button-danger-background`,
    default: "bg-transparent border border-border-default text-text-default hover:text-text-states-hover hover:bg-icon-button-hover active:text-text-states-active",
    secondary: "bg-transparent border border-border-default text-text-default hover:text-text-states-hover hover:bg-icon-button-hover active:text-text-states-active",
};

export const Button: React.FC<ButtonProps> = ({ buttonType = "default", size = "default", testId, className, disabled, children, ...rest }) => (
    <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        className={[
            "flex justify-center items-center cursor-pointer gap-1 rounded-lg font-weight-350",
            SIZE_CLASS[size],
            TYPE_CLASS[buttonType],
            disabled ? "disabled:bg-button-background-disabled disabled:text-button-text-disabled disabled:cursor-not-allowed" : "",
            className ?? "",
        ].join(" ")}
        {...rest}
    >
        {children}
    </button>
);
