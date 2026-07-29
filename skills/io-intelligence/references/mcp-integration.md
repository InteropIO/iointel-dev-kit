# MCP Integration

## Use this reference when

Use for adding, choosing, or changing io.Intelligence MCP infrastructure; exposing application capabilities; consuming MCP from a browser assistant; or deciding between Core, Web, and HTTP.

## Desired outcome

Establish a clear server/client topology in which the intended io.Connect capabilities appear to the intended MCP client through the correct transport and lifecycle.

## Select the transport

### MCP Web

Use `@interopio/mcp-web` when MCP runs in an io.Connect Browser environment. It provides both:

- a server that exposes MCP Core capabilities over io.Connect interop;
- a client that connects to that server and advertises client capabilities.

The server can run as a platform plugin, inside an application, or in the same application as the client. Determine which process owns server startup so duplicate servers are not created accidentally.

### MCP HTTP

Use `@interopio/mcp-http` for a local Node.js server connected to an io.Connect Desktop environment. It wraps MCP Core with Streamable HTTP endpoints and session management. It is server-side only; use a standard MCP HTTP client on the consumer side.

Treat this as a local per-user Desktop integration, not a remote multi-user cloud service.

### MCP Core

Use `@interopio/mcp-core` directly for a specialized transport. Core owns the capability model; the integration owns transport connection and lifecycle.

## Choose the tool type

| Tool type | Source and lifecycle | Use when |
| --- | --- | --- |
| System | Built into MCP Core and gated by configuration, io.Connect APIs, and client capabilities | Discover or start applications and workspaces, retrieve Working Context, or use built-in MCP Apps |
| Static method | Declared in MCP config and delegated to an io.Connect interop method | A centrally managed capability has a known schema and method name |
| Static intent | Declared in MCP config and delegated to an io.Connect intent | The capability is modeled as an intent and may use MCP or io.Connect resolution |
| Dynamic | Advertised by an application through interop registration metadata | The application owns registration and runtime availability |

For exact config shapes, read [MCP Core Tool Types](https://docs-ai.interop.io/api-reference/mcp-core/tool-types.md).

## Decisions to make

1. Which application or process owns the server?
2. Which application or external process is the client?
3. Is the deployment Browser, Desktop-local HTTP, or custom?
4. Which tools must be system, static, or dynamic?
5. Which client capabilities are required?
6. Is Working Context exposed through the MCP server?
7. Are MCP Apps required?
8. Which filters or guards limit visibility?

## Evidence to collect

- Installed MCP packages and their peer dependencies
- Server factory invocation and configuration
- Client factory or AI Web MCP configuration
- Client capability object
- io.Connect initialization and startup order
- Static tool mappings to interop methods or intents
- Dynamic method `description` and `flags.ioIntelMCPTool`
- Application captions and workspace metadata for system search
- Runtime interop method registry
- MCP connection state and the intended client's `listTools` result

## Implementation order

1. Initialize the correct io.Connect API.
2. Start or connect the selected transport in the owning process.
3. Configure MCP Core server identity and capability areas.
4. Add system, static, or dynamic tools according to ownership.
5. Ensure the underlying method, intent, application, or workspace metadata exists.
6. Advertise the client capabilities required by the selected features.
7. Connect the actual consuming client.
8. Observe the capability from that client rather than inferring visibility from server construction alone.

## Important invariants

- Static tool configuration does not create the underlying interop method or intent.
- A dynamic tool exists only while its application-managed interop registration exists.
- Dynamic tool schemas are stored as JSON strings in `ioIntelMCPTool` metadata.
- Constant static methods remain registered as MCP tools; variable methods track underlying interop availability.
- Application search requires usable application metadata, including `caption`.
- Workspace search requires workspace APIs and usable workspace description metadata.
- Some system tools require sampling or elicitation capabilities.
- A server log proving startup is not proof that the intended client connected or received the tool.

## Common wrong turns

- Selecting MCP HTTP for a remote multi-user service simply because HTTP is available
- Starting another MCP Web server without checking whether the platform already hosts one
- Registering an interop method but omitting dynamic MCP metadata
- Configuring a static tool name but mapping it to a different or unavailable method
- Debugging the LLM prompt before proving that `listTools` contains the tool
- Treating application discovery and dynamic tool registration as the same pipeline

## Official documentation

- [MCP Transports](https://docs-ai.interop.io/modules/mcp/transports.md)
- [MCP Core API](https://docs-ai.interop.io/api-reference/mcp-core/api-reference.md)
- [MCP Tool Types](https://docs-ai.interop.io/api-reference/mcp-core/tool-types.md)
- [MCP Web Overview](https://docs-ai.interop.io/api-reference/mcp-web/overview.md)
- [MCP HTTP Overview](https://docs-ai.interop.io/api-reference/mcp-http/overview.md)
- [MCP Web Integration Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/mcp-web-integration.md)
