# Mastra Backend

## Use this reference when

Use when the assistant backend runs on Mastra and should serve AI Web or io.Assist through `@interopio/ai-mastra-bridge`.

## Desired outcome

Register the bridge once in the Mastra server, expose the Agent Protocol route surface, and align agent memory, auth, and frontend configuration with it.

## Mental model

AI Mastra Bridge translates:

- Agent Protocol run input into Mastra invocation;
- Mastra stream chunks into the supported AG-UI event subset;
- frontend-declared tools into temporary Mastra-side proxy tools;
- frontend tool results back into the same active run;
- Mastra memory into frontend-friendly thread and message routes.

It keeps the frontend independent from Mastra-native route and chunk formats.

## Prerequisites

Establish:

- a Mastra application and at least one agent;
- `reflect-metadata` imported at host startup;
- required Mastra, Hono, and bridge dependencies;
- memory on at least one agent when persistent thread behavior is required;
- the middleware boundary for auth, logging, CORS, and deployment policy.

## Implementation order

1. Import `reflect-metadata` once at startup.
2. Create the bridge with `IoMastraBridgeFactory(...)`.
3. Choose the default `/io-bridge` prefix or one intentional custom prefix.
4. Spread `bridge.createHonoRoutes()` into Mastra `server.apiRoutes`.
5. Add host middleware around the routes.
6. Point the frontend `agentServer.baseUrl` at the server origin.
7. Align frontend agent/resource IDs with Mastra agents and memory.

Read the official API page for exact versions and imports.

## Route expectations

The bridge supplies:

- streaming run;
- frontend tool-result callback;
- agent list and read;
- thread create, list, read, update, and delete;
- thread message retrieval.

A custom prefix changes the prefix only, not the route shapes below it.

## Memory boundary

- Stateless streaming can run without persistent memory.
- Thread CRUD requires memory configured on at least one agent.
- Resource ID is part of thread ownership and backend memory scoping.
- Auth middleware must enforce ownership; route parameters alone are not authorization.

## Tool-loop boundary

Frontend tools are proxied into the active Mastra run. The frontend posts a result to the callback route, after which Mastra continues the same run. Do not replace this with a second run request.

Server tools execute in Mastra and still need a visible `TOOL_CALL_RESULT` in the protocol stream.

## Evidence to collect

- Mastra construction and agent registration
- Bridge construction and route registration
- Actual server origin and prefix
- Agent memory configuration
- Middleware ordering
- Agent discovery response
- Run response content type and event sequence
- Tool result callback requests
- Thread and message responses

## Common failure modes

- Routes created but not added to `apiRoutes`
- Frontend base URL or custom prefix mismatch
- Missing `reflect-metadata`
- Thread operations used without Mastra memory
- Auth middleware excludes the callback or stream route
- Frontend tool callback cannot find the active run
- Custom server code consumes or rewrites the SSE response

## Official documentation

- [AI Mastra Bridge Overview](https://docs-ai.interop.io/modules/ai-mastra-bridge/overview.md)
- [API Reference](https://docs-ai.interop.io/api-reference/ai-mastra-bridge/api-reference.md)
- [Routes and Events](https://docs-ai.interop.io/api-reference/ai-mastra-bridge/routes-and-events.md)
- [Examples](https://docs-ai.interop.io/api-reference/ai-mastra-bridge/examples.md)
- [Configure Agent Backend Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/configure-agent-backend.md)
