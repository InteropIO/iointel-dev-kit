import "@interopio/mcp-apps-proxy";

const isWorkspaceMode = new URLSearchParams(window.location.search).get("mode") === "workspace";

const start = async () => {
    if (isWorkspaceMode) {
        const { default: IOBrowser } = await import("@interopio/browser");
        await IOBrowser();
    }
};

window.sandboxProxyStart = start().catch(console.error);
