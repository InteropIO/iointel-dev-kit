import React from "react";

import type { IconResource } from "../../types/icon";
import { isInlineSvg, normalizeIconResource, shouldRenderAsImage, stripSvgAttributes, validateIconResource } from "../../utils/iconUtils";

type IconProps = {
    /** Pixel size of the rendered glyph. */
    size?: number;
    className?: string;
    disabled?: boolean;
    /**
     * Custom icon resource (inline SVG / url / data-url). Takes precedence over `children`,
     * which act as the fallback when it is absent or invalid. Mirrors ng `app-icon`'s `customIcon`.
     */
    customIcon?: IconResource;
    /** Renders the glyph inside a 32px host box, like ng `app-icon`'s `isWrapped`. */
    wrapped?: boolean;
    /** Forwarded onto the host element so tests can target the icon. */
    "data-testid"?: string;
    children?: React.ReactNode;
};

const SVG_WRAPPER_CLASSES = "flex items-center justify-center [&>svg]:h-full [&>svg]:w-full";

const CURSOR_CLASS_BY_DISABLED = (disabled: boolean | undefined): string => (disabled === undefined ? "" : disabled ? "cursor-not-allowed" : "cursor-pointer");

const renderCustomIcon = (customIcon: IconResource | undefined, glyphStyle: React.CSSProperties): React.ReactNode | null => {
    const normalized = customIcon?.data ? normalizeIconResource(customIcon) : customIcon;

    if (!normalized || !validateIconResource(normalized).valid) {
        return null;
    }

    if (isInlineSvg(normalized)) {
        const cleaned = stripSvgAttributes(normalized.data);

        return cleaned ? <div data-testid="icon-svg-wrapper" className={SVG_WRAPPER_CLASSES} style={glyphStyle} dangerouslySetInnerHTML={{ __html: cleaned }} /> : null;
    }

    if (shouldRenderAsImage(normalized)) {
        const mask = `url(${JSON.stringify(normalized.data)}) no-repeat center`;

        return (
            <div
                data-testid="icon-image-wrapper"
                style={{
                    ...glyphStyle,
                    mask,
                    maskSize: "contain",
                    WebkitMask: mask,
                    backgroundColor: "var(--app-text-default)",
                }}
            />
        );
    }

    return null;
};

/**
 * Renders an icon glyph. By default `children` (a static SVG component) is shown in a `size`×`size` box.
 * When `customIcon` is valid it is rendered instead:
 * - inline SVG (sanitised) → `icon-svg-wrapper`
 * - url / data-url (CSS-masked, themable) → `icon-image-wrapper`
 */
export const Icon: React.FC<IconProps> = ({ size = 16, className, disabled, customIcon, wrapped, children, ...rest }) => {
    const glyphStyle: React.CSSProperties = { width: size, height: size };
    const custom = customIcon ? renderCustomIcon(customIcon, glyphStyle) : null;

    if (wrapped) {
        return (
            <span data-testid={rest["data-testid"]} className={["flex size-8 shrink-0 items-center justify-center text-text-default", className ?? ""].filter(Boolean).join(" ")}>
                {custom ?? (
                    <div data-testid="icon-svg-wrapper" className={SVG_WRAPPER_CLASSES} style={glyphStyle}>
                        {children}
                    </div>
                )}
            </span>
        );
    }

    return (
        <span
            data-testid={rest["data-testid"]}
            className={["icon-wrapper pointer-events-none inline-flex items-center justify-center", CURSOR_CLASS_BY_DISABLED(disabled), className ?? ""].filter(Boolean).join(" ")}
            style={glyphStyle}
        >
            {custom ?? children}
        </span>
    );
};
