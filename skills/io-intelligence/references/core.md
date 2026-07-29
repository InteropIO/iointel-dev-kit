# io.Intelligence Core Model

## Use this reference when

Load this file for every io.Intelligence task. It establishes the package roles, topology choices, evidence model, and public-source boundary shared by all other references.

## Source priority

Use this order:

1. Official public documentation at [docs-ai.interop.io](https://docs-ai.interop.io/)
2. The official [llms.txt](https://docs-ai.interop.io/llms.txt) map and direct Markdown pages
3. Curated references in this skill, which add workflow and reasoning
4. Installed package declarations and metadata, which show the locally available surface
5. Customer code and runtime observations, which show how that surface is used

Do not turn internal source or local implementation details into a supported public contract. Under the V1 alignment assumption, report a mismatch if official docs and installed public declarations materially disagree.

## Ecosystem map

| Need | Primary package or contract | Role |
| --- | --- | --- |
| Build the MCP server capability model | `@interopio/mcp-core` | Transport-agnostic MCP server foundation and system, static, and dynamic tools |
| Run MCP inside io.Connect Browser | `@interopio/mcp-web` | Browser server and client transport over io.Connect interop |
| Expose MCP over HTTP for a local Desktop environment | `@interopio/mcp-http` | Server-side Streamable HTTP transport around MCP Core |
| Collect live business context | `@interopio/working-context` | Schema-driven tracking of global, workspace, channel, and app-instance context |
| Build a custom assistant frontend | `@interopio/ai-web` | Framework-agnostic agents, threads, tools, resources, MCP, context, and MCP Apps runtime |
| Embed a ready-made React assistant | `@interopio/io-assist-react` | React UI built on AI Web |
| Embed a ready-made Angular assistant | `@interopio/io-assist-ng` | Angular UI built on AI Web |
| Connect a Mastra backend | `@interopio/ai-mastra-bridge` | Mastra implementation of the io.Intelligence Agent Protocol |
| Connect another backend runtime | io.Intelligence Agent Protocol | AG-UI-based streaming plus io.Intelligence routes, persistence, and frontend-tool behavior |

## Choose the frontend level

### Packaged io.Assist

Choose io.Assist when the product needs a complete assistant UI quickly and its experience fits the ready-made surface. Select React or Angular to match the host application. Both use a static infrastructure config and a dynamic per-user config.

### Custom AI Web

Choose AI Web when the product must own layout, thread presentation, message rendering, controls, or product-specific interaction design. AI Web supplies the assistant runtime but not the product UI.

### Editable io.Assist

Choose a source-owned io.Assist only when packaged configuration is insufficient but the existing experience remains the desired base. This is a one-way fork: the customer owns subsequent changes. The planned ejecting scaffolder is not part of the current release.

## Choose the MCP transport

| Environment | Normal starting point | Important boundary |
| --- | --- | --- |
| io.Connect Browser | MCP Web | Can run as a platform plugin, in an application, or as both server and client in one app |
| io.Connect Desktop with a local server | MCP HTTP | Designed for a local user's Desktop runtime; exposes Streamable HTTP |
| Specialized transport | MCP Core | Supply the transport and lifecycle around the common MCP server |

Transport changes how MCP is connected and operated, not the underlying io.Intelligence capabilities.

## Choose the backend

- Use AI Mastra Bridge when the runtime is Mastra. It exposes Hono routes under `/io-bridge` by default.
- For another runtime, implement the Agent Protocol route and event contract.
- The frontend `agentServer.baseUrl` points at the backend origin; the protocol paths are below it.
- Thread persistence requires backend storage or memory support. Stateless streaming alone does not create a persistent thread system.

## Establish topology before implementation

Find:

1. io.Connect Browser or Desktop and how its API is initialized.
2. Which process hosts the MCP server and which process hosts the MCP client.
3. Whether MCP is Web, remote Streamable HTTP, or both.
4. Whether the frontend is io.Assist or a custom AI Web application.
5. Which backend implements the Agent Protocol.
6. How user identity, auth headers, and resource IDs flow.
7. Whether Working Context, MCP Apps, sampling, or elicitation are required.
8. Where app definitions, workspace metadata, and interop registrations are supplied.

Do not choose code changes until these boundaries are clear.

## Evidence model

### Static project evidence

- Dependency manifests and lockfiles
- Imports and public factory calls
- React props or Angular providers
- AI Web, MCP, Working Context, and bridge configuration
- Backend route registration
- Application and workspace definitions
- Interop method and intent registration

### Installed-package evidence

- Package version and exports
- Public declaration entry points
- Peer dependencies
- Shipped styles or assets

### Runtime evidence

- Registered io.Connect methods and applications
- MCP client/server connection state
- `listTools`, agent-list, thread, and resource results
- Network requests, response status, content type, and SSE event sequence
- Logs from server construction, transport, bridge, or host UI
- Visible thread, tool trace, context, and MCP App behavior

## Cross-package invariants

- Initialize io.Connect before factories that require its API.
- An assistant frontend requires a backend implementing the Agent Protocol even if MCP is not enabled.
- MCP tools and Agent Protocol frontend tools are separate integration surfaces; trace ownership before diagnosing a tool call.
- Client capabilities affect which MCP capabilities and some system tools can be registered.
- AI Web is the runtime beneath both io.Assist deliveries.
- Working Context schema paths and source locations must match real io.Connect context data.
- Interactive MCP Apps require both server-side UI metadata and client-side UI capability plus a sandbox proxy.
- Exact signatures and configuration belong to official API pages, not this skill.

## Official documentation

- [Framework introduction](https://docs-ai.interop.io/index.html.md)
- [MCP overview](https://docs-ai.interop.io/modules/mcp/overview.md)
- [Working Context overview](https://docs-ai.interop.io/modules/working-context/overview.md)
- [AI Web overview](https://docs-ai.interop.io/modules/ai-web/overview.md)
- [io.Assist overview](https://docs-ai.interop.io/modules/io-assist-ng/overview.md)
- [AI Mastra Bridge overview](https://docs-ai.interop.io/modules/ai-mastra-bridge/overview.md)
- [Agent Protocol](https://docs-ai.interop.io/api-reference/ai-server/agent-protocol.md)
