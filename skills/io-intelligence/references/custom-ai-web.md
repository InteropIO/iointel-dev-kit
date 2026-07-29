# Custom AI Web Frontend

## Use this reference when

Use when building or extending a custom assistant or copilot with `@interopio/ai-web` instead of the ready-made io.Assist UI.

## Desired outcome

Create a project-native frontend that owns its UX while preserving the Agent Protocol, thread, MCP, context, tool, and MCP App behavior expected by AI Web.

## Mental model

AI Web is a frontend assistant runtime, not a chat component. `IoAiWebFactory(io, config)` returns namespaces for:

- `agents`
- `threads`
- `tools`
- `resources`
- `system`
- optional `context`
- optional `mcpApps`

The application owns state, rendering, navigation, composer behavior, accessibility, and product-specific interaction design.

## Establish the topology

Determine:

1. Browser or Desktop io.Connect initialization
2. Agent Protocol backend and authentication
3. Agent and resource identity
4. Thread creation and persistence behavior
5. MCP Web, io.Intelligence remote MCP, and additional remote servers
6. Working Context
7. MCP Apps display mode and proxy
8. Sampling and elicitation handlers
9. Framework state model and component lifecycle

## Implementation order

1. Initialize io.Connect.
2. Construct the minimal AI Web config with `agentServer.baseUrl`.
3. Create AI Web and list agents.
4. Establish user/resource identity.
5. Create or reopen a thread and load its messages.
6. Implement run submission with `agent.stream(...)`.
7. Reduce AG-UI events into the project's message and tool state.
8. Implement abort behavior and terminal cleanup.
9. Add tool and resource discovery if MCP is required.
10. Add Working Context, MCP Apps, sampling, and elicitation only when requested.

## Streaming invariants

- Treat `RUN_STARTED` as the start of one run lifecycle.
- Accumulate text only between matching text start and end events.
- Accumulate tool arguments until the tool call closes; arguments form JSON across deltas.
- Distinguish frontend-owned tools from server-owned tools.
- Do not execute a server-owned tool again in the frontend.
- Close open message and tool UI state at a terminal event.
- Preserve thread and resource identifiers across the request, local state, and backend.
- Make cancellation safe for late events and repeated user actions.

Read the [Agent Protocol](https://docs-ai.interop.io/docs/api-reference/ai-server/agent-protocol.md) for exact wire guarantees.

## Thread model

Use the `threads` API for persistent conversations:

- list by resource and agent;
- create with agent and resource identity;
- update title or metadata;
- retrieve message history;
- delete when requested.

Do not treat local rendered messages as the authoritative persistent history. Reconcile them with the backend thread contract.

## MCP model

AI Web can combine:

- io.Intelligence MCP over Web;
- io.Intelligence MCP over remote Streamable HTTP;
- additional remote MCP servers.

Use `tools.list()` and `resources.list()` for the aggregated surface. Server names must be unique. Tool names are deduplicated; inspect `source.mcpName` when provenance matters.

## Evidence to collect

- AI Web factory call and config
- Framework lifecycle around initialization
- Agent discovery response
- Thread IDs, resource IDs, and message retrieval
- Stream event trace from run start to terminal event
- Local reducer/state transitions
- Tool source and ownership
- MCP connection and capability config
- Auth headers and cross-origin behavior
- MCP App instance lifecycle, when enabled

## Common wrong turns

- Building UI state before defining thread and run identity
- Treating `generate()` and `stream()` as unrelated backends
- Rendering raw event objects without a run-state model
- Losing tool-call correlation IDs
- Assuming all tools are executed in the frontend
- Enabling multiple MCP servers with duplicate logical names
- Reinitializing AI Web on every component render
- Coupling the UI directly to Mastra-specific stream chunks instead of the Agent Protocol

## Official documentation

- [AI Web Overview](https://docs-ai.interop.io/modules/ai-web/overview.md)
- [AI Web Capabilities](https://docs-ai.interop.io/docs/modules/ai-web/capabilities.md)
- [AI Web API Reference](https://docs-ai.interop.io/docs/api-reference/ai-web/api-reference.md)
- [AI Web Configuration](https://docs-ai.interop.io/docs/api-reference/ai-web/configuration.md)
- [AI Web Examples](https://docs-ai.interop.io/docs/api-reference/ai-web/examples.md)
- [Custom UI Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/custom-ui-skin-using-ai-web.md)
- [Agent Protocol](https://docs-ai.interop.io/docs/api-reference/ai-server/agent-protocol.md)
