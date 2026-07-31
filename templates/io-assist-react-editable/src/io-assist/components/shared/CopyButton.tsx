import React, { useCallback, useEffect, useRef, useState } from "react";

import { IconButton } from "./IconButton";
import { CheckIcon, CopyHoverIcon, CopyIcon } from "./icons";
import { Tooltip } from "./Tooltip";
import { UI_STRINGS } from "../../constants/uiStrings";
import { copyToClipboard } from "../../utils/clipboard";

const COPIED_DISPLAY_DURATION_MS = 2000;

type Props = {
    textToCopy: string;
    testId?: string;
    size?: number;
    className?: string;
};

/**
 * Copy-to-clipboard button. Mirrors ng AppCopyToClipboardButtonComponent:
 * - default: outline copy icon
 * - hover: filled copy icon
 * - copied: tick icon + a "Copied!" tooltip shown for 2s
 */
export const CopyButton: React.FC<Props> = ({ textToCopy, testId, size = 12, className }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const timerRef = useRef<number | null>(null);

    const handleCopy = useCallback(() => {
        void copyToClipboard(textToCopy).then(() => {
            setIsCopied(true);
            if (timerRef.current) window.clearTimeout(timerRef.current);
            // Each copy restarts the timer, cancelling the previous one.
            timerRef.current = window.setTimeout(() => setIsCopied(false), COPIED_DISPLAY_DURATION_MS);
        });
    }, [textToCopy]);

    useEffect(
        () => () => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
        },
        []
    );

    return (
        <Tooltip position="top" displayMode="event" forceVisible={isCopied} content={UI_STRINGS.GENERAL.COPIED}>
            <IconButton testId={testId} size={size} onClick={handleCopy} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className={className}>
                {isCopied ? <CheckIcon /> : isHovered ? <CopyHoverIcon /> : <CopyIcon />}
            </IconButton>
        </Tooltip>
    );
};
