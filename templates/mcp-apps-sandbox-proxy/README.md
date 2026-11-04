# MCP Apps Sandbox Proxy

A minimal, standalone page that serves as the sandbox proxy required by every MCP Apps host (AI Web, and the io.Assist templates built on it). It installs `@interopio/mcp-apps-proxy` and renders its `<mcp-apps-proxy>` custom element — no application code of its own.

## Why this is a separate template

Any MCP App's HTML comes from an MCP server, not the host application's own codebase. Rendering it directly inside the host's frame would mix untrusted third-party code with the host's origin. The sandbox proxy is the isolation boundary that prevents this, and it has to be served from its own URL so it can be loaded in its own sandboxed iframe. Keeping it as its own template — rather than folded into each io.Assist/AI Web template — keeps those templates to a single, minimal entry point and lets one proxy deployment be reused by every host that needs one.

## Running it

```bash
npm install
npm run start
```

By default this serves at `http://localhost:4321`.

## Wiring a host to this proxy

Point the host's AI Web config at wherever this page is deployed:

```ts
aiWebConfig: {
  mcp: {
    clientsConfig: { capabilities: {} },
    mcpApps: {
      sandboxProxyUrl: "http://localhost:4321",
    },
  },
},
```

The host appends `?mode=workspace` to that URL itself when workspace-mode MCP Apps are active; this page does not need separate configuration for inline vs. workspace, it detects the mode from that query parameter.

## Deploying

For anything beyond local development, deploy this template's build output to any static host reachable by the AI Web host application, and point `sandboxProxyUrl` at that deployment instead of `localhost`.

For the full protocol this page implements, see the `io-intelligence` skill's `sandbox-proxy.md` and `mcp-apps.md` references.
