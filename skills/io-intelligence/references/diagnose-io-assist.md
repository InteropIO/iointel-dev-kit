# Diagnose io.Assist

## Applies when

Use when React or Angular io.Assist fails to bootstrap, renders incorrectly, loses user/thread state, cannot reach the backend or MCP, or behaves incorrectly around tools, context, sampling, elicitation, or MCP Apps.

## Causal model

```text
framework bootstrap and styles
-> static infrastructure config
-> dynamic user config
-> io.Connect initialization
-> AI Web initialization
-> backend and MCP connectivity
-> io.Assist state and presentation
-> optional capability UI
```

Because io.Assist is built on AI Web, determine whether the failure belongs to the framework wrapper, AI Web, backend protocol, or an optional capability.

## Establish framework and delivery

Find:

- React `@interopio/io-assist-react`, or Angular `@interopio/io-assist-ng`;
- installed version and peer dependencies;
- component import and mount point;
- stylesheet import;
- static and dynamic config construction;
- current user/session lifecycle.

Do not apply Angular provider expectations to React or React prop expectations to Angular.

## React bootstrap

Check:

- `IoAssist` receives both `staticConfig` and `dynamicConfig`;
- `dynamicConfig.user.id` exists for the active session;
- user-specific backend headers are in dynamic config;
- stylesheet from `@interopio/io-assist-react/styles` is loaded;
- component is not repeatedly remounted by unstable keys or config objects;
- host container has usable dimensions;
- loading or retry state is not being hidden by surrounding UI.

React config is not validated early by the component. Trace initialization errors to io.Connect or AI Web when the props are malformed.

## Angular bootstrap

Check:

- `provideIoAssist(staticConfig)` is registered in application providers;
- the standalone `IoAssist` component is imported;
- `<io-assist [config]="dynamicConfig">` receives a valid runtime value;
- static config validation error at bootstrap;
- stylesheet and host sizing;
- signal/computed user config reflects login state.

Angular static configuration is validated by the provider; an early throw is different from a later network or runtime failure.

## Blank, clipped, or unstyled UI

Collect:

- DOM output and loading/error state;
- package stylesheet network/build resolution;
- global reset and host/component sizing;
- overflow, flex, and absolute-position ancestors;
- runtime asset requests;
- framework console errors.

If AI Web agent discovery succeeds but the component is visually absent, prioritize style and container evidence.

## User, thread, or auth problems

Trace:

1. current user ID;
2. dynamic config update;
3. agent-server headers;
4. resource ID used for thread calls;
5. returned thread list;
6. component state after login/logout or user switch.

Symptoms that appear as "threads disappeared" may be correct resource scoping after user identity changed.

## Backend or streaming problems

Use [diagnose-ai-web.md](diagnose-ai-web.md) and [diagnose-agent-protocol.md](diagnose-agent-protocol.md) when:

- agents are missing;
- thread routes fail;
- run response is not SSE;
- event sequences are invalid;
- frontend tool continuation stalls.

Do not patch io.Assist state to hide a backend protocol defect.

## MCP and Working Context problems

Remember that these flow through static AI Web configuration.

- For missing tools, prove the MCP client path and use [diagnose-mcp.md](diagnose-mcp.md).
- For missing context, observe the Working Context output before the assistant run.
- For sampling or elicitation, confirm client capabilities and built-in/custom handler ownership.
- For MCP Apps, confirm UI capability, proxy, and display mode before the io.Assist rendering surface.

## Packaged versus editable distinction

If the issue is a documented configuration or integration problem, fix the packaged integration.

If the requested behavior requires changing internal message, thread, tool, or MCP App UI, explain the source-ownership decision. Do not treat a private implementation detail as a supported packaged extension point.

## Stop conditions

Name the owning layer and show evidence at its boundary:

- framework/bootstrap;
- package styles/assets;
- config/user state;
- AI Web;
- Agent Protocol backend;
- MCP or Working Context;
- io.Assist presentation.

Avoid broad fixes across several layers when one causal boundary is unproven.

## Official documentation

- [io.Assist Overview](https://docs-ai.interop.io/modules/io-assist-ng/overview.md)
- [React Component API](https://docs-ai.interop.io/docs/api-reference/io-assist-react/component-api.md)
- [React Configuration](https://docs-ai.interop.io/docs/api-reference/io-assist-react/configuration.md)
- [Angular Component API](https://docs-ai.interop.io/docs/api-reference/io-assist-ng/component-api.md)
- [Angular Configuration](https://docs-ai.interop.io/docs/api-reference/io-assist-ng/configuration.md)
- [Create io.Assist Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/create-io-assist.md)
