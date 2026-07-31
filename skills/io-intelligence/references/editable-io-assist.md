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

## Current delivery boundary

There is still no scaffolding command. The planned five-preset scaffolder is not delivered in this skill release.

The **React editable payload is delivered as a checked-in template**. `templates/io-assist-react-editable` carries the io.Assist React source at `src/io-assist`, with `src/io-assist/PROVENANCE.md` recording its origin repository, commit, package version, and customer-owned status. Copy that template to start a React editable application. It builds and type-checks as-is, but it does **not** run standalone: like every io.Assist preset it requires a valid `AGENT_SERVER_URL` in `src/App.tsx` (an empty string fails AI Web's URL validation) **and** an io.Connect Browser Platform to host it, since `@interopio/browser` is a client that discovers a platform rather than creating one. Without a platform, io.Connect init fails and io.Assist never bootstraps. See the template's `README.md` for the run procedure.

The **Angular editable payload is not materialized**. `templates/io-assist-angular-editable` is still a shell whose imports do not resolve.

Where an approved editable source payload is not already present:

- do not reconstruct io.Assist from this skill;
- do not reverse-engineer compiled package output;
- do not invent a repository-fetching contract;
- ask the user to identify or approve the source to materialize.

## Architecture to preserve

When approved source is available, locate and understand:

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

Preserve, where available:

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
