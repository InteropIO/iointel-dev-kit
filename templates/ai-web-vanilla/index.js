import IOBrowser from '@interopio/browser';
import IOWorkspaces from "@interopio/workspaces-api";
import { IoAiWebFactory } from "@interopio/ai-web";

// this must be defined;
const AGENT_SERVER_URL = '';

const start = async () => {
    const io = await IOBrowser({ libraries: [IOWorkspaces] });

    window.io = io;

    const intel = await IoAiWebFactory(io, {
        agentServer: {
            baseUrl: AGENT_SERVER_URL,
        }
    });

    window.intel = intel;
};

window.clientStart = start().catch(console.error);
