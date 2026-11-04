# Workspace Widget

## Use this reference when

Use when enabling, configuring, or explaining the built-in `io_connect_get_workspace_widget` system tool, or diagnosing why it is missing, disabled, or not fully interactive. Read [mcp-apps.md](mcp-apps.md) first if MCP Apps are not already working end to end — this widget is one specific MCP App, not the mechanism itself.

## Desired outcome

Serve the widget's HTML as the tool's `resource`, confirm the connected client advertises the MCP App UI capability and the io.Connect Workspaces API is available, and — for io.Assist-equivalent fidelity — implement the five custom notifications the widget expects from its host.

## What it is

A built-in MCP App system tool, not a bundled page. Unlike every other system tool, it is **not enabled by default** and has **no default `resource`**. The widget HTML ships as its own installable package, `@interopio/workspace-widget`, versioned and rebuilt independently of `@interopio/mcp-core`.

It has two modes, selected by the AI when it calls the tool:

- `previewer` (default): read-only rendering of an existing workspace layout.
- `builder`: an interactive drag-and-drop canvas for a new layout.

Mode walkthroughs, screenshots, and exact tool input/output schemas live in the official pages below; read them instead of relying on this summary for exact fields.

## Server-side configuration

1. Install `@interopio/workspace-widget` and import `getHTML`.
2. Configure `server.tools.system.getWorkspaceWidget` on the MCP Core server:
   - `resource: getHTML` is required — `() => string | Promise<string>`.
   - A config that sets `getWorkspaceWidget` without `resource` fails validation.
   - A config that omits `getWorkspaceWidget` entirely never registers the tool or its resource, even for a client that fully supports MCP Apps.
   - `resource` can also fetch a pre-built copy served over HTTP instead of importing the package directly.
3. Confirm the connected client advertises `capabilities.extensions["io.modelcontextprotocol/ui"]` with `text/html;profile=mcp-app`, and that the io.Connect Workspaces API is available in that environment.

## Evidence to collect

- `server.tools.system.getWorkspaceWidget` configuration and whether `resource` is actually set
- Server startup/config-validation error when `resource` is missing
- Client capability object for the UI extension and MIME type
- io.Connect Workspaces API availability in the connected environment
- `ui/notifications/*` traffic between host and widget, correlated by `toolCallId`
- Where the host persists saved state (Preferences API, localStorage, backend) and whether it is keyed correctly

## Common failure modes

- Tool absent because `getWorkspaceWidget` was never configured — this is a server config gap, not a client capability gap
- `resource` omitted, so the server fails config validation before ever starting
- Widget renders but never visually "locks" during generation because the host never sends `response-generation-status`
- Widget reopens empty after a thread switch because the host never replays `load-state`
- Widget window never closes after workspace creation because the host ignores `close-ws-app`
- Debugging this as a generic MCP App problem before checking the dedicated `getWorkspaceWidget` config path and its required `resource`

## Official documentation

- [Workspace Widget](https://docs-ai.interop.io/modules/mcp/mcp-apps/workspace-widget.md)
- [Workspace Widget Package Reference](https://docs-ai.interop.io/api-reference/mcp-apps/workspace-widget/overview.md)
- [Workspace Widget Package Examples](https://docs-ai.interop.io/api-reference/mcp-apps/workspace-widget/examples.md)
- [MCP Core Tool Types: `io_connect_get_workspace_widget`](https://docs-ai.interop.io/api-reference/mcp-core/tool-types.md#io_connect_get_workspace_widget)
- [MCP Apps Overview](https://docs-ai.interop.io/modules/mcp/mcp-apps/overview.md)
