---
name: io-intelligence
description: Build, scaffold, extend, explain, or diagnose AI assistants in io.Connect with io.Intelligence. Use for official React, Angular, editable io.Assist, or Vanilla AI Web templates; the io.Assist Anywhere guide or ACME Banking sample; io.Assist React or Angular; @interopio/ai-web custom frontends; @interopio/mcp-core, mcp-web, or mcp-http; Working Context; MCP Apps; sampling; elicitation; @interopio/ai-mastra-bridge; the io.Intelligence Agent Protocol; AG-UI bridge behavior; missing tools or applications; streaming and thread problems; or package and topology selection.
---

# io.Intelligence

Use this skill as the io.Intelligence reasoning and workflow layer. Inspect the developer's actual project, use the official documentation for exact public APIs, and adapt the implementation to the project's framework and conventions.

## Apply the source contract

1. Treat [docs-ai.interop.io](https://docs-ai.interop.io/) as the definitive source for supported public io.Intelligence behavior.
2. Use the official [io.Connect documentation](https://docs.interop.io/) for io.Connect Browser or Desktop platform behavior such as application registration and launch.
3. Use [llms.txt](https://docs-ai.interop.io/llms.txt) or [references/documentation-index.md](references/documentation-index.md) to locate the exact io.Intelligence Markdown pages needed.
4. Use [references/public-api-map.md](references/public-api-map.md) to find API-reference pages, then read those pages for current signatures and configuration.
5. Treat local manifests, installed declarations, project code, logs, network streams, and runtime observations as evidence about the current integration, not as authority for undocumented product behavior.
6. Assume V1 skill knowledge, current official documentation, and installed io.Intelligence packages are aligned. If they conflict, report an unsupported alignment mismatch; do not invent compatibility advice.

## Work from the actual project

- Determine the io.Connect environment, frontend framework, backend runtime, package manager, installed `@interopio/*` packages, and existing integration topology.
- Locate evidence through imports, public factories, configuration objects, providers, routes, registrations, and runtime behavior. Do not assume fixed source directories or a flattened `node_modules`.
- Preserve the project's framework, state-management, authentication, styling, and error-handling conventions.
- Ask only for missing information that materially changes the topology or product behavior.
- Do not impose a skill-specific verification checklist, test matrix, or reporting format. Decide validation from the project, task, available tools, and user instructions.

## Load references progressively

Always read [references/core.md](references/core.md), then load only the task-specific references required.

### Primary task routing

| Task | Read |
| --- | --- |
| Create, scaffold, or materialize an official application template | [references/scaffolding.md](references/scaffolding.md), then the selected delivery reference below |
| Start, follow, understand, or troubleshoot the io.Assist Anywhere guide | [references/io-assist-anywhere-guide.md](references/io-assist-anywhere-guide.md) |
| Expose or consume MCP capabilities; choose Web, HTTP, or Core | [references/mcp-integration.md](references/mcp-integration.md) |
| Add ready-made React or Angular io.Assist | [references/packaged-io-assist.md](references/packaged-io-assist.md) |
| Build a custom assistant frontend with AI Web | [references/custom-ai-web.md](references/custom-ai-web.md) |
| Materialize or customize a source-owned io.Assist | [references/editable-io-assist.md](references/editable-io-assist.md) |
| Implement the Agent Protocol for another backend runtime | [references/backend-adapter.md](references/backend-adapter.md) |

### Optional capability routing

| Capability | Read |
| --- | --- |
| Use Mastra as the backend | [references/mastra-backend.md](references/mastra-backend.md) |
| Add live business context | [references/working-context.md](references/working-context.md) |
| Host interactive MCP UI resources | [references/mcp-apps.md](references/mcp-apps.md) |
| Handle sampling or elicitation | [references/sampling-elicitation.md](references/sampling-elicitation.md) |

### Diagnostic routing

| Symptom area | Read |
| --- | --- |
| MCP connection, discovery, tool, application, or workspace visibility | [references/diagnose-mcp.md](references/diagnose-mcp.md) |
| AI Web initialization, runs, threads, tools, resources, or MCP Apps | [references/diagnose-ai-web.md](references/diagnose-ai-web.md) |
| React or Angular io.Assist bootstrap, rendering, user config, or behavior | [references/diagnose-io-assist.md](references/diagnose-io-assist.md) |
| Agent Protocol routes, SSE events, tool loops, persistence, or discovery | [references/diagnose-agent-protocol.md](references/diagnose-agent-protocol.md) |

## Follow the task workflow

1. Restate the intended developer outcome.
2. Read `core.md` and select the smallest relevant task and capability references.
3. Establish the current topology from project evidence.
4. Resolve exact public APIs from the mapped official pages.
5. Choose an implementation or investigation order based on the references.
6. Explain material topology decisions and unsupported assumptions.
7. Implement or diagnose using the coding agent's normal project tools.

For an io.Assist Anywhere request, establish the current chapter and the user's React/Angular path first. Read the exact current chapter, then use the guide companion and only the product references relevant to that chapter.

For a scaffolding request, select exactly one preset through `scaffolding.md` and run the bundled materializer. Do not inspect unselected template source or recreate a failed download from prose.

## Respect current delivery boundaries

- React and Angular io.Assist are the ready-made frontend choices.
- AI Web is the lower-level choice for a fully custom frontend.
- AI Mastra Bridge is the provided Mastra implementation of the Agent Protocol; other backends implement the protocol directly.
- Project inspection and diagnosis are LLM-led. Do not search for a deterministic io.Intelligence project inspector.
- The official materializer supports five presets: packaged and editable io.Assist for React and Angular, plus a Vanilla JavaScript custom AI Web application.
- Template source comes from the immutable Git tag recorded in the bundled catalog. Do not substitute a branch, a different tag, or an AI-generated approximation.
- Editable io.Assist output is a one-way, customer-owned fork. Do not promise automatic upstream synchronization.
- All templates are io.Connect clients. Follow the runtime evidence boundary in `scaffolding.md` before claiming that behavior was inspected.
