import React from "react";

import { UI_STRINGS } from "../../constants/uiStrings";

type Props = {
    agentName: string;
};

export const WelcomeHeading: React.FC<Props> = ({ agentName }) => (
    <div data-testid="welcome-message" className="flex flex-col gap-3 items-center px-4 pt-[160px]">
        <h2 className="text-[28px] md:text-[44px] font-bold text-text-states-active text-center">{UI_STRINGS.GENERAL.WELCOME_MESSAGE(agentName)}</h2>
    </div>
);
