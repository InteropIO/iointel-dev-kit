# Code Mode

## Use this reference when

Use this reference when advising on Code Mode integration, configuration, or behavior. Treat the official documentation below as the source of truth; this reference organizes the relevant sources and the questions to verify against them.

## Desired outcome

Enable Code Mode at exactly one layer that serves the assistant, deliver the matching WASM file to that host, and let the model use the `getTools`, `getToolDefinition`, and `executeCode` meta-tools to discover and call registered tools, with the host keeping control of tool access.

## Documentation guidelines

Read the relevant official documentation before relying on Code Mode details or giving implementation guidance. Read the API page for the tool contract before writing an adapter. Resolve package versions against both the npm registry and the host's dependency ranges; never choose between those sources without comparing them. If the newest Code Mode release is outside the installed host's range, check the latest host and framework-wrapper releases for a compatible dependency set before deciding to retain the older Code Mode version. Before concluding a package is missing, inspect `node_modules` directly, including junctions and symbolic links that file globbing may skip. Before relying on a package file path shown in the docs, verify that it resolves within the installed package.

If the documentation does not specify an answer, say so or verify it in the installed host code rather than presenting an assumption as fact. Before basing a policy on a tool field, confirm in both the documentation and installed host code that the host populates it; a type declaration alone is insufficient.

Inspect the project before asking integration questions. For an io.Assist project with no other MCP clients, recommend AI Web without asking the user to choose among irrelevant integration layers. Follow the interaction workflow below; do not introduce tool policies the user did not request. Resolve requested policy questions through an explicit answer or delegation before enabling Code Mode.

## User interaction workflow

For Code Mode setup, configuration, customization, troubleshooting, or explanation, establish the user's goal and inspect relevant project evidence first. Apply only the decision points below that affect the request; skip settled or unrelated choices. For each unresolved choice, present viable options, a project-specific recommendation with a brief reason, and "use recommended defaults". Honor existing preferences. Explicit "you decide" delegation applies to one step or the remaining workflow: state the fallbacks and proceed without repeated approval. Silence is not delegation.

1. **Host and configuration.** Inspect dependencies, runtime, assistant initialization, existing providers, environment files, and deployment conventions. Identify the LLM-facing tool owner and exact configuration files. Recommend AI Web for its assistant client, MCP Core for clients without Code Mode, or standalone for a host managing its own model/tools. Explain which values need environment configuration and how they reach the factory; never expose server secrets in browser variables. **Safe fallback:** reuse the existing configuration boundary and closest supported LLM-facing layer, without adding a duplicate provider or unnecessary environment variables.
2. **WASM delivery.** Ask about self-hosting versus an exact-version browser CDN URL, and recommend a concrete source, destination, and runtime location. Check base paths, content security policy, offline needs, and deployment constraints. Node.js requires a filesystem path, not a CDN URL. **Safe fallback:** self-host the matching installed package asset through the existing static/build pipeline, with repeatable copying where needed. Never relax security policy or substitute mismatched WASM.
3. **Tool filtering.** Ask which registered tools, if any, should be excluded through `toolFilter`; verify identifiers and host-supplied metadata before implementing exclusions. Filtering is not authorization. **Safe fallback:** add no new filter; preserve the existing authorized catalog and policies.
4. **Interceptors.** Ask whether `interceptors.onToolCall` should add authorization, approval, validation, or input rewriting. Confirm the decision logic, trusted host inputs, and any required approval mechanism. **Safe fallback:** add no new interceptor and preserve existing enforcement; never fabricate identity, approval, or context.
5. **Optional settings.** Ask about changes to timeout, memory limit, or system instructions, using current documented defaults and explaining relevant tradeoffs. **Safe fallback:** preserve explicit settings and leave other optional settings unset.

Summarize relevant decisions, then implement, investigate, or explain as requested. For changes, follow the applicable implementation steps below and report fallbacks, validation, and unverified checks. Delegated choices need no additional approval gate. If host ownership, asset delivery, or a requested policy cannot be safely resolved, do not enable or change the affected integration; preserve existing behavior, complete independent safe work, and ask for the smallest missing prerequisite. Do not silently drop a requested policy; resolve it or obtain explicit withdrawal.

## Implementation order

1. Identify the layer closest to the LLM and confirm no other layer runs Code Mode for the same assistant.
2. Inspect `node_modules` directly for the relevant packages, including junctions and symbolic links; do not infer that a package is absent from glob results alone. Query the npm registry for the latest `@interopio/code-mode` release and inspect the installed host's declared range (AI Web, MCP Core, or standalone host). For packaged io.Assist, also inspect the latest `@interopio/io-assist-react` or `@interopio/io-assist-ng` release and its AI Web dependency. If the latest Code Mode release is outside the installed host's range, check whether a coordinated host/wrapper upgrade supports it; recommend that compatible set rather than silently pinning the older range. Do not force an unsupported override. State the registry versions and relevant ranges when a coordinated upgrade is unavailable or would require a breaking change. Never copy a version from a docs example.
3. Choose the browser or Node.js entry point based on the host and the API documentation.
4. Verify documented package file paths against the installed package before using them. Deliver the package's WASM file to a browser-served URL or filesystem path as documented; use a version-pinned CDN URL only when deployment allows it.
5. Configure the factory in AI Web, MCP Core, or a standalone session according to the relevant API documentation.
6. Preserve existing policies and apply only user-requested `toolFilter` and `interceptors.onToolCall` additions, after confirming their behavior and inputs in the docs and installed host code. With delegated defaults, add neither policy and retain existing host access controls.
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
- Stopping at the installed host's older Code Mode range without checking whether current host or wrapper releases support the registry's latest Code Mode version
- Assuming a package is absent because globbing did not traverse a `node_modules` junction or symbolic link
- Using a documented package file path without confirming it resolves in the installed package
- Treating sandbox isolation as authorization
- Writing policies based on declared fields without confirming the host populates them
- Stating behavior as fact when the documentation does not specify it
- Asking which integration path to use when the project context already settles it
- Adding unrequested tool policies, weakening existing controls, or enabling Code Mode while a requested policy remains unresolved
- Treating unanswered questions as delegation, or repeatedly asking for decisions the user has explicitly delegated
- Assuming environment variables enable Code Mode without wiring them into the host configuration
- Defaulting to a public CDN without considering deployment policy, or using a browser URL for a Node.js WASM path

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
