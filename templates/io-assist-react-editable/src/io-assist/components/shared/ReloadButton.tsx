import React, { useState } from "react";

import { IconButton } from "./IconButton";
import { ReloadIcon } from "./icons";

type Props = {
    onClick: () => void;
    disabled?: boolean;
    testId?: string;
    size?: number;
    className?: string;
};

/**
 * Reload/regenerate button. Ports ng's HOVER_TILT_45_CLICK_SPIN_270 animation:
 * - hover: smoothly tilts 45° clockwise
 * - click: spins 270° clockwise then settles back to 0°
 * (animation lives in styles/index.css under `.io-reload`).
 */
export const ReloadButton: React.FC<Props> = ({ onClick, disabled = false, testId, size = 12, className }) => {
    const [spinning, setSpinning] = useState(false);

    const handleClick = () => {
        if (disabled) return;
        setSpinning(true);
        onClick();
    };

    return (
        <IconButton type="button" testId={testId} disabled={disabled} size={size} onClick={handleClick} title="Reload response" className={["io-reload", className ?? ""].join(" ")}>
            <span className={`io-reload__icon ${spinning ? "io-reload__icon--spin" : ""}`} onAnimationEnd={() => setSpinning(false)}>
                <ReloadIcon />
            </span>
        </IconButton>
    );
};
