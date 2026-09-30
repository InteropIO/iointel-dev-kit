# Code Mode

## Use this reference when

Use when an assistant should orchestrate tools by writing JavaScript that runs in an isolated QuickJS WebAssembly sandbox, instead of issuing one direct tool call per step.

## Desired outcome

Enable Code Mode at exactly one layer that serves the assistant, deliver the matching WASM file to that host, and let the model use the `getTools`, `getToolDefinition`, and `executeCode` meta-tools to discover and call the registered tools, with the host keeping control of tool access.

## Choose the integration path

### AI Web or io.Assist

Provide the browser factory from `@interopio/code-mode/browser` and its config through the AI Web `codeMode` configuration. io.Assist forwards this through its underlying AI Web static config. AI Web virtualizes the combined tool catalog of every connected MCP server and declares `capabilities.experimental.codeMode` to connected MCP Core servers. Prefer this path whenever AI Web owns the LLM-facing request.

### MCP Core

Configure `server.codeMode` in `@interopio/mcp-core` only when the connecting MCP clients cannot provide Code Mode themselves, such as third-party assistants or IDEs. Programs can reach only that server's tools. Clients that declare Code Mode support receive the plain tool list instead.

### Standalone

Use `@interopio/code-mode` directly when the host owns its model loop. Create a session, register host tools, and pass `getSystemInstruction()` and `session.getLlmTools()` to the model SDK. This path does not require AI Web, MCP Core, io.Assist, or io.Connect.

## Evidence to collect

- Which layer owns the LLM-facing tool list: AI Web, an MCP Core server, or the host's own model loop
- Whether Code Mode is already enabled on another layer serving the same assistant
- Browser or Node.js host, and the matching entry point (`/browser` or `/node`)
- Where the WASM file is served or stored, and whether it matches the installed `@interopio/code-mode` version
- Content security policy or deployment constraints that affect WASM loading or CDN use
- Tools that should be hidden, require approval, or need input rewriting
- Tools that open an interactive UI, such as MCP Apps
- Actual meta-tools the model receives and the tool names returned by `getTools`
- Session ownership and lifetime for standalone hosts

## Implementation order

1. Identify the layer closest to the LLM and confirm no other layer runs Code Mode for the same assistant.
2. Install `@interopio/code-mode` and choose the browser or Node.js entry point for that host.
3. Deliver `@interopio/code-mode/dist/emscripten-module.wasm` to a browser-served URL or filesystem path; use a version-pinned CDN URL only when the deployment allows it.
4. Configure the factory in AI Web, MCP Core, or a standalone session.
5. Add `toolFilter` and `interceptors.onToolCall` policies before exposing side-effecting tools.
6. Confirm the model receives exactly one set of `getTools`, `getToolDefinition`, and `executeCode` meta-tools.
7. Run a multi-step request and confirm the outcome rather than expecting a particular tool-call transcript.
8. For standalone hosts, pass the run's `signal` and optional `context` to `executeCode`, and remove the session when its owner goes away.

## Important invariants

- Enable Code Mode on only one layer per assistant; AI Web rejects a session with more than one Code Mode provider.
- AI Web requires the browser factory; the MCP Core API reference uses the Node.js factory for its server.
- `wasmLocation` is a URL in the browser and a filesystem path in Node.js.
- The WASM file must match the installed package version; copy it again after upgrading.
- `toolFilter` removes a tool from both discovery and execution.
- `onToolCall` can allow a call, deny it with a reason, or run it with replacement input.
- Defaults: `timeout` 30000 ms, `memoryLimit` 128 MB.
- Per-execution `context` reaches `onToolCall` as `callContext` and tools as `options.context`; sandbox code cannot read or forge it.
- `getLlmTools()` captures the current registry; call it again after `setTools()` for future runs.
- Removing a session aborts its in-flight execution without affecting other sessions or the shared sandbox.
- Sandbox code cannot display UI, so interactive tools such as MCP Apps remain available directly.
- Isolation does not make underlying tools safe; the host still validates inputs and enforces authorization.

## Common wrong turns

- Enabling Code Mode on several MCP servers used by the same Code Mode-unaware client, producing clashing meta-tools
- Enabling server-side Code Mode on an MCP Core server that AI Web already virtualizes
- Importing the Node.js entry point in a browser app, or the reverse
- Serving the WASM file from a path that differs from `wasmLocation`, or leaving a stale file after an upgrade
- Using an unpinned CDN URL for the WASM asset
- Treating the sandbox as authorization instead of adding filters, interceptors, and tool-side validation
- Hardcoding tool names in generated code instead of using the names returned by `getTools`
- Expecting sandboxed code to open MCP App UI
- Debugging model behavior before proving the meta-tools and WASM load correctly

## Official documentation

- [Code Mode Overview](https://docs-ai.interop.io/modules/code-mode/overview.md)
- [Capabilities](https://docs-ai.interop.io/modules/code-mode/capabilities.md)
- [Integration](https://docs-ai.interop.io/modules/code-mode/integration.md)
- [API Overview](https://docs-ai.interop.io/api-reference/code-mode/overview.md)
- [Configuration](https://docs-ai.interop.io/api-reference/code-mode/configuration.md)
- [Examples](https://docs-ai.interop.io/api-reference/code-mode/examples.md)
- [AI Web CodeModeConfig](https://docs-ai.interop.io/api-reference/ai-web/configuration.md)
- [MCP Core CodeModeConfig](https://docs-ai.interop.io/api-reference/mcp-core/api-reference.md)
- [Add Code Mode Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/add-code-mode.md)
