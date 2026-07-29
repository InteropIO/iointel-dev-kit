# Diagnose the Agent Protocol

## Applies when

Use for `/io-bridge` route failures, invalid run requests, malformed SSE, missing or duplicated tool results, stalled frontend tool calls, incorrect thread history, or agent discovery failures.

## Causal model

```text
HTTP route and auth
-> input validation and message conversion
-> runtime invocation
-> event translation
-> frontend/server tool coordination
-> persistence
-> terminal cleanup
```

Capture the raw route and event evidence before debugging the frontend presentation.

## Route inventory

Determine which cumulative protocol level the backend claims:

- `/run`
- `/runs/:runId/tool-calls/:toolCallId/result`
- `/agents` and `/agents/:agentId`
- thread create/list/read/update/delete
- thread message retrieval

Confirm the configured prefix. A healthy backend under a custom prefix will look missing if the frontend assumes `/io-bridge`.

## Run input failure

Inspect:

- request content type;
- `threadId`;
- `runId`;
- `messages`;
- `tools`;
- `context`;
- optional `forwardedProps`;
- auth and resource ownership;
- message-role conversion.

Classify a bridge validation error separately from an agent-runtime error.

## SSE lifecycle failure

Record every event in order and check:

1. `RUN_STARTED` is first.
2. Text start/content/end sequences are balanced.
3. Text deltas are non-empty.
4. Tool start/args/end sequences are balanced.
5. Concatenated argument deltas parse as JSON.
6. Results reference known tool-call IDs.
7. Step events do not break message/tool correlation.
8. `RUN_FINISHED` or `RUN_ERROR` is last.
9. No event follows a terminal event.

Find the first invalid event; later UI corruption is usually a consequence.

## Frontend tool stalls

Trace both directions:

```text
run request declares frontend tool
-> backend exposes it to the runtime
-> runtime chooses it
-> backend emits start/args/end
-> frontend recognizes ownership and executes
-> frontend posts result with runId + toolCallId
-> backend resolves pending call
-> runtime continues
-> backend emits TOOL_CALL_RESULT and terminal event
```

Likely boundaries:

- tool declaration missing from run input;
- backend registered it as the wrong runtime tool type;
- frontend does not recognize ownership;
- callback URL/prefix/auth mismatch;
- IDs changed during translation;
- active-run correlation expired;
- backend waits for a second run instead of continuing the first.

## Duplicate tool execution

Check whether the tool is:

- frontend-owned;
- server-owned;
- visible from MCP but represented to the agent as a frontend tool;
- registered independently in both frontend and backend.

The frontend executes only tools it owns. A backend-emitted server result must not trigger another local execution.

## Thread or history failure

Collect:

- resource and agent IDs;
- storage/memory availability;
- create/list/read/update/delete responses;
- message ordering and pagination parameters;
- stored assistant tool calls and tool messages;
- role conversion;
- authorization result.

Preserve assistant `toolCalls` and tool-message `toolCallId` so replay remains coherent. Do not forward `activity` or `reasoning` history to the model.

## Agent discovery failure

Check:

- agent registration in the backend runtime;
- prefix and route registration;
- auth middleware;
- public response shape;
- frontend filtering by ID/name;
- whether the frontend points at the same process being inspected.

## Mastra-specific branch

When using AI Mastra Bridge, also check:

- `createHonoRoutes()` is included in Mastra `apiRoutes`;
- memory exists when thread CRUD is expected;
- Mastra chunk-to-event translation;
- frontend proxy tools remain in the same run;
- middleware does not consume streaming responses.

Use [mastra-backend.md](mastra-backend.md) for the normal topology.

## Stop conditions

Claim a protocol defect only after identifying:

- the exact route or first invalid event;
- expected behavior from the official protocol;
- observed request, response, or correlation data;
- the owning adapter layer.

If the wire contract is valid, continue in the frontend state layer rather than changing the backend.

## Official documentation

- [Agent Protocol](https://docs-ai.interop.io/api-reference/ai-server/agent-protocol.md)
- [AI Mastra Bridge Routes and Events](https://docs-ai.interop.io/api-reference/ai-mastra-bridge/routes-and-events.md)
- [AI Mastra Bridge API](https://docs-ai.interop.io/api-reference/ai-mastra-bridge/api-reference.md)
- [AI Web API](https://docs-ai.interop.io/api-reference/ai-web/api-reference.md)
