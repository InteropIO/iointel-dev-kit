# MCP Apps

## Use this reference when

Use when an MCP tool should return an interactive HTML application rendered inline in a conversation or as an io.Connect workspace window — including turning an existing static or dynamic tool into one, enabling the built-in Workspace Widget, configuring the required sandbox proxy, or hosting MCP Apps served by a third-party or remote MCP server.

## Orientation: three files, one domain

MCP Apps has several moving parts that are easy to conflate. This file is the entry point and covers the mechanism shared by all of them. Load the other two only for their specific topic:

| Topic | File |
| --- | --- |
| The MCP App mechanism itself: capability negotiation, resource URIs, display modes, lifecycle, end-to-end wiring | This file |
| Turning any static or dynamic tool into an MCP App via its `resource` | This file, [Turning a tool into an MCP App](#turning-a-tool-into-an-mcp-app) below |
| The five custom notifications a host implements for full MCP App fidelity (response lock, state persistence, auto-close) | This file, [Custom notifications](#custom-notifications) below |
| The built-in `io_connect_get_workspace_widget` tool: its two modes, server config | [references/workspace-widget.md](workspace-widget.md) |
| The sandbox proxy required by every MCP App host: `@interopio/mcp-apps-proxy`, display-mode transports, building a custom one | [references/sandbox-proxy.md](sandbox-proxy.md) |

Do not duplicate workspace-widget or sandbox-proxy detail here — route to those files instead.

## Desired outcome

Connect server-side UI tool metadata, client capability negotiation, sandboxed rendering, and host lifecycle into one working MCP App flow — whether the UI comes from a custom static/dynamic tool, the built-in Workspace Widget, or another MCP App entirely.

## Responsibility split

| Layer | Responsibility |
| --- | --- |
| MCP Core | Attach UI resource metadata to tools and expose UI tools only to capable clients |
| AI Web | Act as the browser host, detect UI tool calls, manage app instances, state, messages, and workspace windows |
| io.Assist | Provide the ready-made inline/workspace visual hosting surface on top of AI Web |
| Sandbox proxy | Isolate the untrusted MCP App HTML in its own sandboxed iframe and relay messages — see [sandbox-proxy.md](sandbox-proxy.md) |
| MCP App HTML | Render the app and participate through standard host/app messaging |

Do not diagnose the entire feature as one component. Prove each boundary.

## Required end-to-end pieces

1. A tool with a `resource` attached — a system tool (e.g. `getWorkspaceWidget`), a static method tool, or a dynamic tool. See [Turning a tool into an MCP App](#turning-a-tool-into-an-mcp-app).
2. The HTML resource that `resource` produces, available through MCP at its resource URI.
3. Client capability: `extensions["io.modelcontextprotocol/ui"].mimeTypes` includes `text/html;profile=mcp-app`.
4. AI Web `mcpApps` configuration with a `sandboxProxyUrl` — see [sandbox-proxy.md](sandbox-proxy.md).
5. A host surface for inline rendering or io.Connect Workspace support.
6. Message routing between host, proxy, and guest app.

## Turning a tool into an MCP App

Any tool type that accepts a `resource` renders its result as an interactive HTML panel instead of plain text. Every other tool type always returns plain text, regardless of client capability:

| Tool type | MCP App support | `resource` type | Where to set it |
| --- | :---: | --- | --- |
| System: `getWorkspaceWidget` | ✅ | `() => string \| Promise<string>` | `server.tools.system.getWorkspaceWidget.resource` (required — see [workspace-widget.md](workspace-widget.md)) |
| Static method tool | ✅ | `() => string \| Promise<string>` | `server.tools.static.methods[].resource` (optional) |
| Dynamic tool (`flags.ioIntelMCPTool`) | ✅ | `string` | `flags.ioIntelMCPTool.resource` (optional) |
| Static intent tool | ❌ | — | — |
| System: `searchApps`, `searchWorkspaces`, `startApps`, `startWorkspaces`, `getWorkingContext` | ❌ | — | — |

Dynamic tools are registered from another application over interop, so their `resource` must be a plain HTML string rather than a function — the registering application cannot hand the server a live function reference across that boundary.

When a `resource` is present, MCP Core:

- Assigns the tool a resource URI — `ui://<server-name>/<tool-name>` by default, or whatever `config._meta.ui.resourceUri` already specifies.
- Registers the tool as an MCP App for clients that advertise the UI capability, and as a regular text tool for every other client.
- Publishes a UI resource at that URI serving the HTML from `resource`.

Registration timing follows the tool's own lifecycle:

- `constant` static method tools and `getWorkspaceWidget` publish their resource at server startup, alongside the tool itself.
- `variable` static method tools and dynamic tools publish their resource only once the underlying interop method appears, and remove it again once the method disappears.
- Each resource URI can only belong to one tool at a time. A colliding URI is skipped with a warning — do not assume both tools are live just because both are configured.

For exact config shapes and schemas, read [MCP Core Tool Types](https://docs-ai.interop.io/api-reference/mcp-core/tool-types.md#mcp-app-resources) — this table summarizes it, it does not replace it.

## Third-party and remote MCP servers

MCP Apps is a protocol-level convention built on the MCP UI extension, not something exclusive to `@interopio/mcp-core`. Any MCP server that attaches UI resource metadata to a tool — including a third-party server registered under AI Web's `mcp.remoteServers` config, unrelated to `@interopio/mcp-core` entirely — produces an MCP App the same way `getWorkspaceWidget` or a dynamic tool does. AI Web, the sandbox proxy, and io.Assist only inspect the tool's resource metadata and the negotiated client capability; they do not care which server produced the tool.

Consequences:

- Hosting a third-party server's MCP Apps needs no io.Intelligence-specific tool configuration — register that server under `mcp.remoteServers` (or `mcp.ioIntel.remote` for the io.Intelligence server itself) like any other remote MCP server, and make sure the sandbox proxy and UI client capability are already configured, same as for our own tools. See [sandbox-proxy.md](sandbox-proxy.md) and [AI Web Configuration: `MCPConfig`](https://docs-ai.interop.io/api-reference/ai-web/configuration.md#mcpconfig).
- The System/Static/Dynamic resource contract table above only describes servers built with `@interopio/mcp-core`. A third-party server can use its own tool model, but it must still follow the MCP UI extension contract — a resolvable resource URI and the `text/html;profile=mcp-app` MIME type — to be recognized as an MCP App rather than a plain-text tool.
- Diagnosing a third-party server's MCP App starts the same way as diagnosing ours: confirm the tool's resource URI actually resolves and the client capability is advertised, per [diagnose-mcp.md](diagnose-mcp.md).

## Display modes

- Inline renders inside the conversation.
- Workspace opens a dedicated io.Connect window.
- When display mode is omitted, AI Web resolves it from the runtime environment.
- Workspace mode on Desktop requires the supported in-memory app-store configuration and Desktop version described by the official MCP Apps page.

## Custom notifications

Beyond the standard tool-call-result and `postMessage`/io.Connect protocol traffic every MCP App uses, any MCP App can rely on five additional notifications for full host fidelity — response lock during generation, state persistence across thread switches, and auto-close on completion. io.Assist implements all five for every MCP App it hosts, including the Workspace Widget. A custom MCP-UI-capable host must implement them itself to match that behavior; without them, an MCP App still renders, it just loses this behavior.

| Direction | Method | Purpose |
| --- | --- | --- |
| Host → App | `ui/notifications/response-generation-status` | Lock/unlock controls while the assistant is generating a response |
| Host → App | `ui/notifications/load-state` | Restore previously saved state after a thread switch |
| Host → App | `ui/notifications/save-state-response` | Acknowledge a state write (success or failure) |
| App → Host | `ui/notifications/save-state` | Checkpoint the app's current state, keyed by `toolCallId` |
| App → Host | `ui/notifications/close-ws-app` | Signal that the app's job is done and it should be closed |

The Workspace Widget is the reference implementation of these five notifications on the app side — see [workspace-widget.md](workspace-widget.md#custom-notifications-host-responsibility) for how it uses each one. Any other MCP App can implement the same contract.

## Lifecycle

1. The agent calls a UI-enabled tool.
2. The host creates the app.
3. Tool arguments and result reach the app.
4. The user interacts; the app may call tools or send a conversation message.
5. The host reports response-generation state.
6. The app may save state or request close.
7. Thread switches close current apps and returning to a thread can restore them.

## Evidence to collect

- Tool definition and its resource URI (`ui://<server-name>/<tool-name>` or `_meta.ui.resourceUri` override)
- Resource listing/read result and returned MIME type
- Whether the tool's resource is `constant`/startup-scoped or `variable`/dynamic and lifecycle-scoped
- A resource-URI-collision warning in server logs
- Client initialize capabilities
- AI Web MCP and `mcpApps` config
- Sandbox proxy URL response and framing/security headers
- Selected display mode
- Workspace API and Desktop app-store configuration
- Tool-call and result events
- `postMessage` or io.Connect interop traffic
- AI Web app-created, recreate, message, and close behavior

## Common failure modes

- Tool registered for non-UI clients but omitted for the actual UI client
- Resource URI does not resolve to the expected HTML resource
- UI capability missing or MIME type misspelled
- A `resource` configured on a static intent tool or a system tool other than `getWorkspaceWidget` — those tool types never support one
- Two tools resolving to the same resource URI; the second is silently skipped with only a log warning
- A `variable` static or dynamic tool's resource expected to exist before its underlying interop method is registered
- Sandbox proxy missing, unreachable, or unable to create the inner frame — see [sandbox-proxy.md](sandbox-proxy.md#common-failure-modes)
- Workspace mode selected where Workspace support is unavailable
- Host renders the app but fails to deliver tool input/result
- Thread switch discards state because host lifecycle is bypassed
- Custom UI reimplements part of AI Web lifecycle and creates duplicate app instances
- The built-in Workspace Widget treated as a generic MCP App problem instead of checking its own dedicated config path — see [workspace-widget.md](workspace-widget.md)
- An MCP App renders but never locks, restores, or auto-closes because the host never implemented the five [custom notifications](#custom-notifications)

## Official documentation

- [MCP Apps Overview](https://docs-ai.interop.io/modules/mcp/mcp-apps/overview.md)
- [Workspace Widget](https://docs-ai.interop.io/modules/mcp/mcp-apps/workspace-widget.md)
- [Sandbox Proxy](https://docs-ai.interop.io/modules/mcp/mcp-apps/sandbox-proxy.md)
- [MCP Core Tool Types: MCP App Resources](https://docs-ai.interop.io/api-reference/mcp-core/tool-types.md#mcp-app-resources)
- [AI Web Capabilities](https://docs-ai.interop.io/modules/ai-web/capabilities.md)
- [AI Web Configuration](https://docs-ai.interop.io/api-reference/ai-web/configuration.md#mcpappsconfig)
- [Add MCP Apps Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/add-support-for-mcp-apps.md)
