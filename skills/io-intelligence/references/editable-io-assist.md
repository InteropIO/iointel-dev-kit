# Editable io.Assist

## Use this reference when

Use when a developer wants the ready-made io.Assist experience but needs source-level visual or behavioral changes that packaged configuration cannot provide.

## Desired outcome

Make an explicit, source-owned fork decision, preserve the io.Assist architectural invariants that matter, and customize the approved source without pretending it remains automatically upgradeable.

## Decide whether to eject

Prefer packaged io.Assist when the requested outcome can be achieved through documented:

- static or dynamic configuration;
- prompts;
- MCP, context, or backend configuration;
- host layout and surrounding UI;
- supported styling boundaries.

Prefer a custom AI Web frontend when the product wants a substantially different assistant experience.

Use editable io.Assist when:

- io.Assist remains the desired experience;
- the change is inside its message, thread, tool, MCP App, sampling, elicitation, or layout behavior;
- the developer accepts ownership of the resulting source.

## One-way ownership contract

The editable application is a customer-owned fork:

- local changes need not remain equivalent to future io.Assist versions;
- automatic upstream merges are not promised;
- the source origin should remain recorded;
- future update guidance may compare versions, but it is not currently delivered.

Do not describe the fork as a theme, plugin, or supported extension point unless the official package documentation defines it that way.

## Materialize the approved source

Read [Template Scaffolding](scaffolding.md) and use the bundled materializer to retrieve `io-assist-react-editable` or `io-assist-angular-editable`. These catalog entries identify the approved source at an immutable Git tag.

Do not reconstruct io.Assist from this skill, reverse-engineer compiled package output, substitute the packaged preset, or fetch a branch if materialization fails. Report the failure and preserve the one-way source-ownership decision.

## Architecture to preserve

After materialization, locate and understand:

- AI Web initialization and lifetime;
- static versus dynamic configuration;
- agent, thread, and message state;
- run and streaming event reduction;
- frontend and server tool traces;
- sampling and elicitation UI;
- MCP App inline and workspace lifecycle;
- Working Context presentation;
- persistence and user scoping;
- framework-specific providers, stores, services, or contexts;
- packaged styles and runtime assets.

Change the smallest coherent area. Avoid bypassing the AI Web and Agent Protocol contracts to achieve a UI-only customization.

## Evidence to collect

- Framework and source origin
- Source package and version, if known
- AI Web and framework dependency versions
- Existing customizations
- Requested behavior and the current owning component/service/store
- Thread, run, tool, or MCP App states affected
- Styles and assets used by the affected surface
- Public contracts the fork still consumes

## Record provenance

Keep `.io-intelligence-template.json` at the generated project root and preserve:

- io.Assist framework and source package;
- source package version;
- AI Web version;
- materialization date;
- feature preset or configuration;
- a note that the source is customer-owned.

This information helps later agents reason about the fork without promising automated updates.

## Official documentation

- [io.Assist Overview](https://docs-ai.interop.io/modules/io-assist-ng/overview.md)
- [io.Assist Capabilities](https://docs-ai.interop.io/modules/io-assist-ng/capabilities.md)
- [React API](https://docs-ai.interop.io/api-reference/io-assist-react/overview.md)
- [Angular API](https://docs-ai.interop.io/api-reference/io-assist-ng/overview.md)
- [AI Web Overview](https://docs-ai.interop.io/modules/ai-web/overview.md)
- [Agent Protocol](https://docs-ai.interop.io/api-reference/ai-server/agent-protocol.md)
