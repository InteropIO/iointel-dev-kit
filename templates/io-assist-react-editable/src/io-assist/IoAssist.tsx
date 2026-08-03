import React from "react";

import { Chat } from "./components/chat/Chat";
import { Spinner } from "./components/shared/icons";
import { UI_STRINGS } from "./constants/uiStrings";
import { IoAssistProvider } from "./context/IoAssistContext";
import { useIoAssistStore } from "./context/IoAssistContext";
import { useIoAiWebBootstrap } from "./hooks/useIoAiWebBootstrap";
import { useIoConnectBootstrap } from "./hooks/useIoConnectBootstrap";
import type { IoAssistStaticConfig, IoAssistDynamicConfig } from "./types";
import { LOADING_STATES } from "./types/loading";

type Props = {
    staticConfig: IoAssistStaticConfig;
    dynamicConfig: IoAssistDynamicConfig;
};

/**
 * Root IoAssist component.
 * Wrap in your own router/auth shell and pass validated configs.
 */
export function IoAssist({ staticConfig, dynamicConfig }: Props): React.JSX.Element {
    return (
        <IoAssistProvider staticConfig={staticConfig} dynamicConfig={dynamicConfig}>
            <IoAssistInner />
        </IoAssistProvider>
    );
}

const IoAssistInner: React.FC = () => {
    useIoConnectBootstrap();
    useIoAiWebBootstrap();

    const appLoadingState = useIoAssistStore((s) => s.appLoadingState);

    if (appLoadingState.type === LOADING_STATES.LOADING || appLoadingState.type === LOADING_STATES.NOT_STARTED) {
        return <LoadingScreen />;
    }

    if (appLoadingState.type === LOADING_STATES.ERROR) {
        return <ErrorScreen onRetry={() => window.location.reload()} />;
    }

    return <Chat />;
};

const LoadingScreen: React.FC = () => (
    <div className="flex items-center justify-center w-full h-full bg-app-background">
        <Spinner className="size-10" />
    </div>
);

const ErrorScreen: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div className="flex items-center justify-center w-full h-full bg-app-background">
        <div className="flex flex-col items-center gap-4 text-center px-6 max-w-sm">
            <p className="text-4xl">⚠️</p>
            <p className="text-sm font-medium text-text-default">{UI_STRINGS.LOADING_STATE.ERROR}</p>
            <button type="button" className="px-4 py-2 rounded-xl bg-app-accent-color-1 text-white text-sm hover:opacity-90 transition-opacity" onClick={onRetry}>
                {UI_STRINGS.LOADING_STATE.RETRY}
            </button>
        </div>
    </div>
);
