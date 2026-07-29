# Diagnose MCP

## Applies when

Use for MCP server connection failures, missing tools, dynamic methods not becoming tools, applications or workspaces absent from system search, or tool calls that reach the wrong or unavailable io.Connect capability.

## Causal model

Investigate in this order:

```text
owning process and io.Connect lifecycle
-> transport server
-> intended client connection
-> capability negotiation
-> MCP Core tool construction
-> discovery and visibility filters
-> underlying io.Connect capability
-> tool invocation and response
```

A later stage cannot repair a failed earlier stage.

## 1. Establish the intended topology

Find:

- Browser or Desktop environment
- Server-owning process
- Client-owning process
- MCP Web, HTTP, or custom transport
- Whether AI Web is the MCP host
- Whether another MCP server with the same apparent role is already running

Do not debug a tool definition until the intended client/server pair is unambiguous.

## 2. Prove transport and client identity

Collect:

- server factory completion or failure;
- MCP Web interop server method, or HTTP endpoint and session behavior;
- client factory/AI Web connection config;
- connection or initialize errors;
- the actual client capability object;
- the intended client's `listTools` result.

Server startup without the intended client connection does not prove visibility.

## 3. Classify the missing capability

### System tool

Check:

- system tool enabled in MCP Core config;
- required io.Connect API available;
- required client sampling, elicitation, or UI capability advertised;
- configured guard result;
- application/workspace metadata requirements.

### Static method or intent tool

Check:

- static config reached the server;
- tool name and schema are valid;
- availability is `constant` or `variable` as intended;
- mapped method/intent name matches the underlying registration;
- allowed-application or resolution filters;
- variable capability currently has an eligible handler.

### Dynamic tool

Check:

- the application instance is running;
- interop registration completed after io.Connect initialization;
- method has a useful `description`;
- `flags.ioIntelMCPTool` exists;
- `name`, `inputSchema`, and `outputSchema` are present;
- schemas are valid JSON strings;
- MCP Core dynamic methods are enabled;
- the dynamic guard returns true;
- registration existed before or during the server's method-availability observation;
- the intended client is still connected and received tool-list change behavior.

## Dynamic tool not visible

Use this focused sequence:

1. Find the real `io.interop.register(...)` call.
2. Observe the runtime method definition, including flags.
3. Parse both schema strings.
4. Find MCP Core's dynamic configuration and guard.
5. Identify the server instance observing that io.Connect environment.
6. Identify the client instance querying that server.
7. Compare runtime registry evidence with that client's `listTools`.

Interpretation:

- Missing from interop registry: application lifecycle or registration problem.
- Present in interop, missing MCP metadata: application advertisement problem.
- Correct metadata, guard false: server visibility policy.
- Correct and allowed, no client connection: transport/topology problem.
- Present in server-facing evidence, absent only in UI/LLM: client refresh, host, or presentation problem.

## Application not discovered

System application search is not dynamic tool discovery.

Check:

- application definition is available to the connected io.Connect environment;
- `caption` describes what the app does;
- `customProperties.interop` describes methods, context, or intents when relevant;
- search-app system tool is enabled;
- client advertises sampling;
- guard includes the application;
- search request describes an intent the metadata can satisfy.

An application can run and register interop methods yet remain unsuitable for system search because its discovery metadata is incomplete.

## Workspace not discovered

Check:

- Workspaces API is available;
- workspace definition is available in the current environment;
- `metadata.description` is present;
- `metadata.contextSchema` describes required workflow context when relevant;
- search-workspaces system tool is enabled;
- client advertises sampling;
- workspace guard includes it.

## Tool visible but invocation fails

Trace:

1. tool input after schema validation;
2. mapped interop method or intent;
3. eligible application/handler;
4. timeout and allowed-application filters;
5. returned value;
6. output schema compatibility;
7. transport response to the client.

Do not treat a successful `listTools` result as proof that the delegated io.Connect capability is callable.

## Stop conditions

Claim a cause only when evidence identifies:

- the first failed causal stage;
- the configuration or runtime fact at that stage;
- why later visible symptoms follow from it.

If official docs and installed public declarations conflict, report an alignment mismatch instead of selecting an undocumented interpretation.

## Official documentation

- [MCP Tool Types](https://docs-ai.interop.io/api-reference/mcp-core/tool-types.md)
- [MCP Core API](https://docs-ai.interop.io/api-reference/mcp-core/api-reference.md)
- [MCP Web API](https://docs-ai.interop.io/api-reference/mcp-web/overview.md)
- [MCP HTTP API](https://docs-ai.interop.io/api-reference/mcp-http/overview.md)
- [Update App Definitions Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/updating-app-definitions.md)
