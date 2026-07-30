import { ApplicationConfig, provideBrowserGlobalErrorListeners } from "@angular/core";
import IOBrowser from "@interopio/browser";
import { provideIoAssist } from "@interopio/io-assist-ng";
import IOWorkspaces from "@interopio/workspaces-api";

const AGENT_SERVER_URL = "http://localhost:4111";

const createIOConnect: typeof IOBrowser = async (config) => {
    const io = await IOBrowser(config);

    (window as any).io = io;

    return io;
};

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideIoAssist({
            connectConfig: {
                browser: {
                    factory: createIOConnect,
                    config: {
                        libraries: [IOWorkspaces],
                        modals: {
                            dialogs: {
                                enabled: true,
                            },
                        },
                    },
                },
            },
            defaultAgentName: "io-agent",
            aiWebConfig: {
                agentServer: {
                    baseUrl: AGENT_SERVER_URL,
                }
            },
        }),
    ],
};
