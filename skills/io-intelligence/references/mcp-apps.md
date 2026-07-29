# MCP Apps

## Use this reference when

Use when an MCP tool should return an interactive HTML application rendered inline in a conversation or as an io.Connect workspace window.

## Desired outcome

Connect server-side UI tool metadata, client capability negotiation, sandboxed rendering, and host lifecycle into one working MCP App flow.

## Responsibility split

| Layer | Responsibility |
| --- | --- |
| MCP Core | Attach UI resource metadata to tools and expose UI tools only to capable clients |
| AI Web | Act as the browser host, detect UI tool calls, manage app instances, state, messages, and workspace windows |
| io.Assist | Provide the ready-made inline/workspace visual hosting surface on top of AI Web |
| MCP App HTML | Render the app and participate through standard host/app messaging |

Do not diagnose the entire feature as one component. Prove each boundary.

## Required end-to-end pieces

1. An MCP tool with `_meta.ui.resourceUri`.
2. An HTML resource available through MCP.
3. Client capability:

   `extensions["io.modelcontextprotocol/ui"].mimeTypes` includes `text/html;profile=mcp-app`.

4. AI Web `mcpApps` configuration with a sandbox proxy URL.
5. A host surface for inline rendering or io.Connect Workspace support.
6. Message routing between host, proxy, and guest app.

## Display modes

- Inline renders inside the conversation.
- Workspace opens a dedicated io.Connect window.
- When display mode is omitted, AI Web resolves it from the runtime environment.
- Workspace mode on Desktop requires the supported in-memory app-store configuration and Desktop version described by the official MCP Apps page.

## Lifecycle

1. The agent calls a UI-enabled tool.
2. The host creates the app.
3. Tool arguments and result reach the app.
4. The user interacts; the app may call tools or send a conversation message.
5. The host reports response-generation state.
6. The app may save state or request close.
7. Thread switches close current apps and returning to a thread can restore them.

## Evidence to collect

- Tool definition and `_meta.ui.resourceUri`
- Resource listing/read result and returned MIME type
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
- Sandbox proxy missing, unreachable, or unable to create the inner frame
- Workspace mode selected where Workspace support is unavailable
- Host renders the app but fails to deliver tool input/result
- Thread switch discards state because host lifecycle is bypassed
- Custom UI reimplements part of AI Web lifecycle and creates duplicate app instances

## Official documentation

- [MCP Apps Overview](https://docs-ai.interop.io/modules/mcp/mcp-apps/overview.md)
- [Workspace Widget](https://docs-ai.interop.io/modules/mcp/mcp-apps/workspace-widget.md)
- [AI Web Capabilities](https://docs-ai.interop.io/modules/ai-web/capabilities.md)
- [AI Web Configuration](https://docs-ai.interop.io/api-reference/ai-web/configuration.md#mcpappsconfig)
- [Add MCP Apps Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/add-support-for-mcp-apps.md)
