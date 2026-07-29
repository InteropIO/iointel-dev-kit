# Custom Agent Protocol Backend Adapter

## Use this reference when

Use when implementing or evaluating a backend for AI Web or io.Assist in a runtime other than Mastra.

## Desired outcome

Expose the cumulative Agent Protocol level required by the frontend while preserving route shapes, SSE lifecycle, tool ownership, thread semantics, and passthrough data.

## Protocol boundary

The io.Intelligence Agent Protocol starts with AG-UI streaming and adds:

- the `/io-bridge` route surface;
- agent discovery;
- thread and message REST APIs;
- frontend tool-result reporting;
- `forwardedProps` conventions.

AI Web does not consume arbitrary backend-native streaming. Translate the runtime into this contract.

## Select the conformance level

| Level | Required behavior |
| --- | --- |
| 1 | `POST /run` streaming core |
| 2 | Tool events and frontend/server tool-loop behavior |
| 3 | Thread and message persistence routes |
| 4 | Agent discovery routes |

Determine which frontend features require which level. Normal AI Web and io.Assist usage expects the full route surface.

## Implement in dependency order

1. Define adapter boundaries between HTTP, runtime invocation, event translation, tool coordination, and persistence.
2. Implement agent discovery and stable public agent shapes.
3. Validate and translate the run input.
4. Produce a Streamable HTTP SSE response.
5. Map runtime output into the supported event subset.
6. Enforce stream lifecycle guarantees.
7. Add server-side tool results.
8. Add frontend tool declarations, pending-result correlation, and the result callback route.
9. Add persistent thread CRUD and message retrieval.
10. Preserve safe unknown `forwardedProps`.

## Run contract

Core input includes:

- `threadId`
- `runId`
- `messages`
- `tools`
- `context`
- optional `forwardedProps`

Return `text/event-stream` for `POST /run`.

Required lifecycle:

- `RUN_STARTED` first;
- one of `RUN_FINISHED` or `RUN_ERROR` last;
- no events after the terminal event;
- close every text and tool sequence before termination;
- emit non-empty text deltas;
- make concatenated tool-argument deltas valid JSON.

## Tool ownership

### Frontend tool

1. Emit tool start, argument deltas, and tool end.
2. Wait for `POST /runs/:runId/tool-calls/:toolCallId/result`.
3. Correlate by run and tool-call IDs.
4. Continue the same logical run with its memory and reasoning state.
5. Emit the result through the backend stream.

### Server tool

Execute in the backend and emit its result. The frontend must not execute it again.

Mixed turns are valid. Do not classify ownership from event visibility alone; use the declared tool source and runtime registration.

## Message conversion

- Preserve supported roles and correlation data.
- Do not forward `activity` messages to the model.
- Do not forward `reasoning` messages to the model.
- Preserve assistant `toolCalls` and tool-message `toolCallId` for replay.
- Keep storage shapes separate from model-provider shapes and wire-event shapes.

## Persistence

Thread operations need a stable resource ownership model and backend storage. Define:

- thread creation;
- listing by resource and optionally agent;
- read, update, and delete;
- message retrieval;
- ordering and pagination semantics;
- authorization at every resource boundary.

Stateless streaming may work without persistence, but it does not satisfy the thread contract.

## Evidence to collect

- Runtime-native request and stream types
- Current HTTP framework and middleware
- Auth/resource ownership model
- Storage and message schemas
- Runtime tool registration and execution model
- Cancellation and error signals
- Complete emitted event trace for text and tool runs
- Frontend callback timing and correlation

## Common failure modes

- Returning backend-native chunks instead of protocol events
- Emitting a terminal event while a text or tool sequence is open
- Starting a second run to continue a frontend tool call
- Losing tool-call IDs during message conversion
- Forwarding frontend-only roles to the model
- Treating thread ID as sufficient authorization
- Rejecting safe unknown `forwardedProps`
- Implementing thread routes over a runtime with no persistent storage

## Official documentation

- [Agent Protocol](https://docs-ai.interop.io/docs/api-reference/ai-server/agent-protocol.md)
- [AI Web API](https://docs-ai.interop.io/docs/api-reference/ai-web/api-reference.md)
- [AI Mastra Bridge Overview](https://docs-ai.interop.io/modules/ai-mastra-bridge/overview.md)
- [Mastra Routes and Events](https://docs-ai.interop.io/docs/api-reference/ai-mastra-bridge/routes-and-events.md)
