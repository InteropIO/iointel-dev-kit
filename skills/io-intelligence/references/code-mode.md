# Code Mode

## Use this reference when

Use this reference when advising on Code Mode integration, configuration, or behavior. Treat the official documentation below as the source of truth; this reference organizes the relevant sources and the questions to verify against them.

## Desired outcome

Enable Code Mode at exactly one layer that serves the assistant, deliver the matching WASM file to that host, and let the model use the `getTools`, `getToolDefinition`, and `executeCode` meta-tools to discover and call registered tools, with the host keeping control of tool access.

## Documentation guidelines

Read the relevant official documentation before relying on Code Mode details or giving implementation guidance. Read the API page for the tool contract before writing an adapter. Do not copy package versions from documentation examples; resolve versions from the npm registry or the range required by installed host packages. Before concluding a package is missing, inspect `node_modules` directly, including junctions and symbolic links that file globbing may skip. Before relying on a package file path shown in the docs, verify that it resolves within the installed package.

If the documentation does not specify an answer, say so or verify it in the installed host code rather than presenting an assumption as fact. Before basing a policy on a tool field, confirm in both the documentation and installed host code that the host populates it; a type declaration alone is insufficient.

Inspect the project before asking integration questions. For an io.Assist project with no other MCP clients, use the AI Web documentation without asking which integration layer to choose. Do not introduce tool policies the user did not request, and wait for answers to requested policy questions before enabling Code Mode.

## Implementation order

1. Identify the layer closest to the LLM and confirm no other layer runs Code Mode for the same assistant.
2. Inspect `node_modules` directly for the relevant packages, including junctions and symbolic links; do not infer that a package is absent from glob results alone. Resolve `@interopio/code-mode` from the npm registry or the version range required by the installed AI Web/MCP Core packages; never copy a version from a docs example.
3. Choose the browser or Node.js entry point based on the host and the API documentation.
4. Verify documented package file paths against the installed package before using them. Deliver the package's WASM file to a browser-served URL or filesystem path as documented; use a version-pinned CDN URL only when deployment allows it.
5. Configure the factory in AI Web, MCP Core, or a standalone session according to the relevant API documentation.
6. Apply only user-requested `toolFilter` and `interceptors.onToolCall` policies, after confirming their behavior and inputs in the docs and installed host code.
7. Confirm the model receives the documented Code Mode meta-tools.
8. Run a multi-step request and confirm the outcome rather than expecting a particular tool-call transcript.
9. For standalone hosts, follow the API documentation for execution signals, context, and session cleanup.

## Important invariants

- Enable Code Mode on only one layer per assistant; verify this constraint in the integration documentation.
- Use the host-appropriate entry point and WASM location described by the API documentation.
- Keep the WASM file aligned with the installed package version.
- Verify documented `toolFilter` and `onToolCall` behavior before configuring policies; confirm policy fields are populated by the host.
- Do not treat sandbox isolation as authorization; verify host-side validation and access-control responsibilities in the docs and installed code.

## Common wrong turns

- Enabling Code Mode at multiple layers for the same assistant
- Configuring MCP Core when AI Web already owns the LLM-facing tool catalog
- Using the browser entry point in a Node.js host, or vice versa
- Serving a WASM file from a location that differs from the configured location, or leaving a stale file after an upgrade
- Copying an example package version instead of checking the npm registry or installed host package range
- Assuming a package is absent because globbing did not traverse a `node_modules` junction or symbolic link
- Using a documented package file path without confirming it resolves in the installed package
- Treating sandbox isolation as authorization
- Writing policies based on declared fields without confirming the host populates them
- Stating behavior as fact when the documentation does not specify it
- Asking which integration path to use when the project context already settles it
- Adding unrequested tool policies or enabling Code Mode before requested policy questions are answered

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
