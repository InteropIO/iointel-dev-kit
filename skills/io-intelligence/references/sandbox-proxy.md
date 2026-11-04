# Sandbox Proxy

## Use this reference when

Use when configuring `sandboxProxyUrl` for AI Web or another MCP App host with the ready-made `@interopio/mcp-apps-proxy` package, or diagnosing why MCP App HTML fails to render or does not isolate correctly. Read [mcp-apps.md](mcp-apps.md) first for the overall MCP App flow this proxy sits inside.

## Desired outcome

Serve a sandbox proxy page at a URL the host can reach, have it isolate untrusted MCP App HTML inside its own sandboxed inner iframe, and have it relay JSON-RPC messages between host and guest over the transport that matches the active display mode.

## Why it is required

MCP App HTML comes from the MCP server, not the host's own codebase. Rendering it directly inside the host's own frame would mix untrusted third-party code with the host's origin. The sandbox proxy is the isolation boundary that prevents this: it runs in the host's trusted frame, loads the actual MCP App HTML into its own sandboxed inner iframe, and relays messages between the two sides.

The proxy page itself is **not** sandboxed — only its inner iframe is. That inner iframe is the real security boundary. Every MCP App host needs one; `@interopio/ai-web` and the ready-made io.Assist apps all require `mcp.mcpApps.sandboxProxyUrl`.

## Use the ready-made package

`@interopio/mcp-apps-proxy` packages the MCP Apps spec's sandbox-proxy section as an installable `<mcp-apps-proxy>` custom element, instead of a hand-written or copy-pasted HTML file.

1. Install `@interopio/mcp-apps-proxy`.
2. Serve a page that imports it and renders `<mcp-apps-proxy></mcp-apps-proxy>`.
3. Point the host's `sandboxProxyUrl` at that page. Nothing changes on the host side — the package implements the exact same `sandboxProxyUrl` contract a hand-written proxy page would.
4. In workspace mode, that same page must also initialize io.Connect (`IOBrowser()`/`IODesktop()`) somewhere on it. The element never receives `io` directly; it discovers the page's already-initialized instance itself through the window `"Glue42"` event handshake those factories wire up internally. The package has no dependency on `@interopio/browser`/`@interopio/desktop` and never calls them itself.
5. The element is a plain custom element with no framework dependency — it works the same whether the serving page is vanilla HTML, Angular, or React.

## Inline vs. workspace mode

The same proxy page handles both display modes. The host appends `?mode=workspace` to the configured `sandboxProxyUrl` to select which one; the proxy switches transport accordingly:

- **Inline** (default): relays messages over `window.postMessage`.
- **Workspace**: relays messages over io.Connect interop, since `postMessage` cannot reach across separate windows.

The host decides the display mode and appends the query parameter. This is not something the proxy page or its consumer configures directly — see [mcp-apps.md](mcp-apps.md) for how display mode is resolved.

## Evidence to collect

- `mcp.mcpApps.sandboxProxyUrl` value and whether it actually resolves
- Whether the served page registers `<mcp-apps-proxy>` or a custom implementation
- `?mode=workspace` presence or absence on the loaded proxy URL
- Where/whether the proxy page calls `IOBrowser()`/`IODesktop()` in workspace mode
- Inner iframe creation and its `sandbox` attribute
- JSON-RPC traffic between host, proxy, and inner iframe
- Console and network errors on the proxy page itself

## Common failure modes

- `sandboxProxyUrl` missing, unreachable, or pointed at the wrong deployment, so no app instance is ever created
- Workspace mode selected but the proxy page never calls `IOBrowser()`/`IODesktop()`, so the element cannot discover an `io` instance
- A second, competing io.Connect instance initialized specifically for the proxy page instead of letting it discover the host's existing one
- Treating the proxy page itself as the sandboxed boundary — only its inner iframe is

## Official documentation

- [Sandbox Proxy](https://docs-ai.interop.io/modules/mcp/mcp-apps/sandbox-proxy.md)
- [Sandbox Proxy Package Reference](https://docs-ai.interop.io/api-reference/mcp-apps/sandbox-proxy/overview.md)
- [Sandbox Proxy Package Examples](https://docs-ai.interop.io/api-reference/mcp-apps/sandbox-proxy/examples.md)
- [AI Web Configuration: `mcpAppsConfig`](https://docs-ai.interop.io/api-reference/ai-web/configuration.md#mcpappsconfig)
- [The Sandbox Proxy protocol (AI Web examples)](https://docs-ai.interop.io/api-reference/ai-web/examples.md#the-sandbox-proxy)
