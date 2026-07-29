# Diagnose AI Web

## Applies when

Use when AI Web fails to initialize, agents or threads are missing, runs do not stream correctly, tools/resources are unavailable, or MCP Apps do not render or survive lifecycle changes.

## Causal model

```text
io.Connect initialization
-> AI Web configuration and factory
-> Agent Protocol connectivity
-> agent/resource/thread identity
-> run request
-> SSE event lifecycle
-> local state reduction
-> optional MCP/context/MCP App layers
```

Separate the base agent path from optional capability paths. Prove minimal agent discovery before debugging MCP Apps or context.

## Initialization failure

Collect:

- io.Connect factory result;
- AI Web factory inputs;
- `agentServer.baseUrl`, headers, credentials, and abort signal;
- config validation error;
- duplicate remote MCP server names;
- MCP Apps config and proxy URL;
- network failure and browser console error.

Classify:

- io.Connect unavailable: host/bootstrap problem.
- factory rejects before network: configuration problem.
- `/io-bridge/agents` unreachable or unauthorized: backend/auth problem.
- MCP connection fails while agent API works: optional MCP topology problem.

## Agents unavailable

Check:

1. backend origin and route prefix;
2. agent discovery route status and response;
3. auth headers;
4. backend agent registration;
5. frontend assumptions about agent ID or name;
6. whether an empty list is a valid backend result or a UI filtering mistake.

Do not diagnose the run stream before agent discovery is coherent.

## Threads missing or not persistent

Trace:

- resource ID and agent ID used for list/create;
- returned thread ID;
- backend storage or Mastra memory;
- auth ownership checks;
- message retrieval request;
- local thread state deletion versus backend thread deletion;
- UI filters and ordering.

Common distinction:

- Thread exists only locally: frontend state problem.
- Thread routes work but history is empty: persistence/message conversion problem.
- Thread routes fail while streaming works: backend supports a lower protocol level or lacks memory.
- Threads appear under another user: resource-scoping problem.

## Run does not stream

Inspect:

1. request URL, method, headers, and JSON body;
2. required `threadId`, `runId`, `messages`, `tools`, and `context`;
3. response status and `text/event-stream` content type;
4. first event;
5. event order through terminal event;
6. browser/HTTP buffering or proxy behavior;
7. local subscription and reducer.

### Stream arrives but UI is wrong

Compare raw events with state transitions:

- text start/content/end correlation;
- non-empty deltas;
- tool start/args/end/result correlation;
- step boundaries;
- terminal cleanup;
- late events after abort;
- multiple concurrent runs updating one thread.

If raw events are valid, the defect is in the custom UI state model rather than AI Web transport.

## Tools or resources missing

Check:

- `mcp` config exists and `clientsConfig.capabilities` is present;
- io.Intelligence Web/remote path matches the server;
- additional remote server names are unique;
- transport connection completed;
- `tools.list()` or `resources.list()` result;
- tool `source.mcpName`;
- local tool toggle state;
- duplicate tool-name behavior.

Distinguish MCP tools from Agent Protocol frontend tools. They may converge in a run, but their discovery and execution ownership differ.

## Working Context missing

Prove Working Context independently:

1. factory present in AI Web config;
2. schema matches real source data;
3. `aiWeb.context` exists;
4. current context contains the expected property;
5. run construction includes the intended context behavior.

Use [working-context.md](working-context.md) for schema reasoning.

## MCP App missing or broken

Trace:

1. UI-enabled tool in tool list;
2. UI resource metadata and resource read;
3. client UI capability;
4. AI Web `mcpApps` API exists;
5. sandbox proxy loads;
6. app-created lifecycle event;
7. selected display mode;
8. host/app messages;
9. thread-switch close and restore.

If the tool call appears but no `mcpApps` API exists, inspect configuration before rendering code.

## Stop conditions

Identify the first failed boundary and show the direct evidence. Do not attribute a symptom to AI Web when the raw backend, MCP server, context source, or custom reducer is the failing owner.

## Official documentation

- [AI Web API](https://docs-ai.interop.io/docs/api-reference/ai-web/api-reference.md)
- [AI Web Configuration](https://docs-ai.interop.io/docs/api-reference/ai-web/configuration.md)
- [Agent Protocol](https://docs-ai.interop.io/docs/api-reference/ai-server/agent-protocol.md)
- [MCP Apps](https://docs-ai.interop.io/modules/mcp/mcp-apps/overview.md)
- [Custom AI Web Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/custom-ui-skin-using-ai-web.md)
