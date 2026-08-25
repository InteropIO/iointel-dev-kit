import { useMemo } from "react";
import IOBrowser from "@interopio/browser";
import {
  IoAssist,
  type IoAssistDynamicConfig,
  type IoAssistStaticConfig,
} from "./io-assist";
import IOWorkspaces from "@interopio/workspaces-api";
import "./App.css";

// this must be defined;
const AGENT_SERVER_URL = "http://localhost:4111";

const createIOConnect: typeof IOBrowser = async (config) => {
  const io = await IOBrowser(config);

  (window as unknown as { io: typeof io }).io = io;

  return io;
};

const staticConfig: IoAssistStaticConfig = {
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
    },
  },
};

function App() {
  const dynamicConfig = useMemo<IoAssistDynamicConfig>(
    () => ({
      user: {
        id: "acme-advisor",
        name: "ACME Advisor",
      },
    }),
    [],
  );

  return (
    <main className="assist-shell">
      <IoAssist staticConfig={staticConfig} dynamicConfig={dynamicConfig} />
    </main>
  );
}

export default App;
