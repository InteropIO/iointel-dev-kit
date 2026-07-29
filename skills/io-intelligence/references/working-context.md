# Working Context

## Use this reference when

Use when applications or assistants need live business context from io.Connect global contexts, workspaces, channels, or application instances.

## Desired outcome

Define a schema whose source locations and paths match real io.Connect data, then expose the resulting context through the appropriate standalone, AI Web, io.Assist, or MCP integration.

## Choose the integration path

### Standalone

Create Working Context directly when application code needs `get()` and `onChanged()` for context-aware behavior without MCP.

### AI Web or io.Assist

Provide the Working Context factory and schema through AI Web configuration. io.Assist forwards this through its underlying AI Web static config.

### MCP Core

Configure Working Context in the io.Intelligence MCP server to expose the built-in `io_connect_get_working_context` tool. This integration is specific to io.Intelligence MCP.

## Model the schema

Each property declares:

- `type`: string, number, boolean, object, or array;
- optional human-readable `description`;
- exactly one source location;
- a dot-notation path within that source.

Supported source locations:

| Source | Selector |
| --- | --- |
| Global context | context names |
| Workspace | `my`, `focused`, or `hybrid` |
| Channel | `my` or a channel name |
| Application instance | application names |

Read the schema reference for environment limitations of target modes.

## Evidence to collect

- The real context object and the moment it becomes available
- The owning global context, workspace, channel, or app instance
- Exact nested path and actual value type
- Browser or Desktop environment and Workspace API availability
- Application names and lifecycle for app-instance sources
- Factory configuration in standalone, AI Web, io.Assist, or MCP
- Current output of `get()` and changes observed through `onChanged()`

## Implementation order

1. Observe the real source data.
2. Choose the narrowest source location that represents ownership correctly.
3. Define one property at a time with a precise description and matching type.
4. Initialize the factory after io.Connect.
5. Observe `get()` before wiring downstream assistant behavior.
6. Observe `onChanged()` while changing the real source.
7. Integrate the working context into AI Web, io.Assist, or MCP.
8. Ensure prompts or agent logic interpret the documented property descriptions.

## Important invariants

- Each property uses exactly one source location.
- Type mismatch logs a warning and prevents the invalid value from becoming usable context.
- A correct schema cannot recover data that is not present in the selected context.
- Workspace tracking depends on Workspace API availability and environment support.
- Application-instance tracking depends on the named application being present and exposing context.
- The MCP tool exposes the current aggregated Working Context; it does not create the underlying data.

## Common wrong turns

- Designing the schema from an assumed object rather than observed context
- Using a workspace target unsupported in the current environment
- Combining several source locations in one property
- Pointing to a parent object while declaring a scalar type
- Expecting AI Web to infer a schema
- Debugging the LLM before proving Working Context contains the expected value

## Official documentation

- [Working Context Overview](https://docs-ai.interop.io/modules/working-context/overview.md)
- [Integration](https://docs-ai.interop.io/modules/working-context/integration.md)
- [API Overview](https://docs-ai.interop.io/api-reference/working-context/overview.md)
- [Schema Configuration](https://docs-ai.interop.io/api-reference/working-context/schema-configuration.md)
- [Examples](https://docs-ai.interop.io/api-reference/working-context/examples.md)
- [Add Working Context Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/add-working-context.md)
