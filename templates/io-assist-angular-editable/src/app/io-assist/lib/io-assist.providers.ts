import { EnvironmentProviders, makeEnvironmentProviders, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, signal, Type } from "@angular/core";
import { provideIoConnect } from "@interopio/ng";
import { provideEffects } from "@ngrx/effects";
import { provideStore } from "@ngrx/store";
import { provideStoreDevtools } from "@ngrx/store-devtools";

import { IO_ASSIST_CONFIG, IO_ASSIST_DYNAMIC_CONFIG, IoAssistStaticConfig, IoAssistDynamicConfig } from "./io-assist.config";
import { IoAssistStaticConfigSchema } from "./io-assist.schema";
import { appEffects, appReducers } from "./shared/store/app.state";

export function provideIoAssist(config: IoAssistStaticConfig): EnvironmentProviders {
    console.info("Trying to start IoAssist with configuration:", {
        agentServerBaseUrl: config.aiWebConfig?.agentServer?.baseUrl,
        defaultAgentName: config.defaultAgentName,
    });

    const parsedConfig = IoAssistStaticConfigSchema.parse(config);

    if (!parsedConfig) {
        throw new Error("Invalid IoAssist configuration provided.");
    }

    console.info("IoAssist configuration parsed successfully:", {
        agentServerBaseUrl: parsedConfig.aiWebConfig?.agentServer?.baseUrl,
        defaultAgentName: parsedConfig.defaultAgentName,
    });

    return makeEnvironmentProviders([
        { provide: IO_ASSIST_CONFIG, useValue: parsedConfig },
        {
            provide: IO_ASSIST_DYNAMIC_CONFIG,
            useFactory: () => signal<IoAssistDynamicConfig>({ user: { id: "" } }),
        },
        provideBrowserGlobalErrorListeners(),
        provideZonelessChangeDetection(),
        provideEffects(...(appEffects as Type<unknown>[])),
        provideStore(appReducers),
        provideStoreDevtools({ maxAge: 25 }),
        provideIoConnect(config.connectConfig),
    ]);
}
