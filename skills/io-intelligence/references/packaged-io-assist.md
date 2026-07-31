# Packaged io.Assist

## Use this reference when

Use when adding the ready-made io.Assist UI to a React or Angular application, choosing between io.Assist and AI Web, or configuring the packaged assistant's frontend/backend topology.

## Desired outcome

Embed the framework-appropriate io.Assist component, connect it to io.Connect and an Agent Protocol backend, and configure only the requested MCP, context, prompt, and user features.

## Choose packaged versus custom

Use packaged io.Assist when the product wants the ready-made conversation UI, thread management, prompts, tool traces, MCP Apps, and Working Context support.

Use AI Web directly when product-specific layout, message rendering, controls, or interaction behavior requires ownership of the frontend experience.

Use an editable source-owned io.Assist only when packaged configuration is insufficient and io.Assist remains the desired base.

## Shared topology

Both deliveries:

- are built on AI Web;
- require a backend implementing the io.Intelligence Agent Protocol;
- split configuration into static infrastructure and dynamic per-user data;
- can use MCP and Working Context through the underlying AI Web configuration;
- can host MCP Apps and capability flows.

Establish the backend, MCP, context, authentication, and user identity choices before writing framework code.

## React integration

Use `@interopio/io-assist-react`.

The public integration surface is:

- `IoAssist`
- `IoAssistStaticConfig`
- `IoAssistDynamicConfig`

Pass both configs directly to `<IoAssist staticConfig={...} dynamicConfig={...} />`. Import the stylesheet from `@interopio/io-assist-react/styles`.

Keep infrastructure known at application bootstrap in `staticConfig`. Put the active user and per-user agent-server headers in `dynamicConfig`. Compute and memoize dynamic config according to the host app's authentication model.

## Angular integration

Use `@interopio/io-assist-ng`.

Register static infrastructure with `provideIoAssist(...)`. Render the standalone `IoAssist` component with `<io-assist [config]="...">`, passing `IoAssistDynamicConfig` for the active user and per-user headers. Import the package styles.

The Angular provider validates static configuration during bootstrap; resolve those errors at the provider boundary.

## Evidence to collect

- Host framework and version
- Existing io.Connect platform package and initialization pattern
- Existing global/component style strategy
- Agent server base URL and auth flow
- Active user ID and resource ownership model
- MCP Web or remote MCP topology
- Working Context schema, if required
- MCP Apps proxy and display-mode requirements, if required
- Existing application registration in io.Connect

## Implementation order

1. Read the framework-specific component, configuration, and example pages.
2. Add the matching package and required peer dependencies.
3. Import the packaged stylesheet through the project's normal style entry point.
4. Define static infrastructure configuration.
5. Derive dynamic user configuration from the host app's auth/session state.
6. Mount the framework component in an appropriately sized shell.
7. Add optional MCP, Working Context, prompts, or MCP Apps one capability at a time.
8. Keep backend auth headers user-specific when the authentication model requires it.

## Common failure modes

- React stylesheet not imported
- Angular provider missing or configured in the wrong bootstrap surface
- Static and dynamic config responsibilities mixed
- Component mounted before a valid user is available
- Agent base URL points to a server that does not implement `/io-bridge`
- MCP server exists but the underlying AI Web client is not configured to reach it
- MCP Apps enabled without UI capability or sandbox proxy
- Container sizing makes a healthy assistant appear blank or clipped

## Current scaffolding boundary

The planned scaffolder will eventually create packaged React and Angular applications. It is not delivered in this skill release, and there is no scaffolding command; do not invoke or invent one.

Starting-point applications exist at `templates/io-assist-react-packaged` and `templates/io-assist-angular-packaged`, to be copied manually. For an existing project, implement the integration using the official framework pages and project-native conventions rather than adapting a template.

## Official documentation

- [io.Assist Overview](https://docs-ai.interop.io/modules/io-assist-ng/overview.md)
- [React API Overview](https://docs-ai.interop.io/api-reference/io-assist-react/overview.md)
- [React Component API](https://docs-ai.interop.io/api-reference/io-assist-react/component-api.md)
- [React Configuration](https://docs-ai.interop.io/api-reference/io-assist-react/configuration.md)
- [Angular API Overview](https://docs-ai.interop.io/api-reference/io-assist-ng/overview.md)
- [Angular Component API](https://docs-ai.interop.io/api-reference/io-assist-ng/component-api.md)
- [Angular Configuration](https://docs-ai.interop.io/api-reference/io-assist-ng/configuration.md)
- [Create io.Assist Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/create-io-assist.md)
