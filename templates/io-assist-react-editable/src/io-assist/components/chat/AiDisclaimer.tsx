import React from "react";

import { UI_STRINGS } from "../../constants/uiStrings";

type Props = {
    showMessageArea: boolean;
};

export const AiDisclaimer: React.FC<Props> = ({ showMessageArea }) => (
    <div className={["flex justify-center items-end text-center p-4", showMessageArea ? "pt-4" : "flex-1 pt-0"].join(" ")}>
        <span className="text-xs text-text-default tracking-wide">{UI_STRINGS.GENERAL.AI_CONTENT_INFO}</span>
    </div>
);
