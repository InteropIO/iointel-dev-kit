# Sampling and Elicitation

## Use this reference when

Use when an MCP server asks the client host to involve a model through sampling or gather user input through elicitation, or when capability-gated system tools are missing.

## Desired outcome

Advertise only the capabilities the host can fulfill, route requests to the correct application handler, and return success, rejection, cancellation, or error without losing the originating server and request context.

## Mental model

Sampling and elicitation are MCP client capabilities. The server can request them only after the client advertises support.

- Sampling asks the client side to perform a model-assisted operation.
- Elicitation asks the host to obtain structured user input or a decision.

io.Assist supplies built-in UI for these flows. A custom AI Web application supplies handlers in `mcp.clientsConfig.capabilities`.

## Decisions to make

1. Does the host truly support sampling, elicitation, or both?
2. Will io.Assist built-in UI handle it, or must the custom frontend implement handlers?
3. What user confirmation and disclosure are appropriate?
4. How are server identity and requested parameters presented?
5. How are cancellation and rejection represented in the current public API?
6. Which system tools depend on the capability?

## Implementation order

1. Read the current `MCPClientConfig` types.
2. Implement the host interaction or model path.
3. Define handlers with the official response shapes.
4. Advertise the capability only when its handler or built-in host behavior is usable.
5. Keep the UI pending state tied to the individual request.
6. Return the chosen outcome to the requesting server.
7. Handle cancellation during thread switches, unmount, disconnect, or user rejection.

## Evidence to collect

- Client capabilities sent during MCP initialization
- Whether strict capability enforcement is enabled
- Registered sampling and elicitation handlers
- Requesting server name and parameters
- User interaction state
- Handler response or thrown error
- Server behavior after the response
- System tool configuration and registration result

## Important invariants

- Configuring a system tool does not override missing client capabilities.
- A capability should not be advertised if the host cannot complete its requests.
- Sampling and elicitation are not ordinary MCP tool calls; trace their request/response lifecycle separately.
- Do not silently approve a user-sensitive request.
- Keep concurrent requests isolated by their own state and correlation.
- Built-in io.Assist behavior and custom AI Web handlers solve the same host responsibility at different UI levels.

## Common failure modes

- Empty capability objects assumed to provide a complete host behavior
- Handler exists but is not included in the client initialization config
- Server expects sampling while the connected client is a different application
- Custom dialog closes without returning a valid protocol outcome
- One global pending dialog corrupts concurrent requests
- Capability removed on reconnect because a different config path is used

## Official documentation

- [AI Web Configuration: MCPClientConfig](https://docs-ai.interop.io/docs/api-reference/ai-web/configuration.md#mcpclientconfig)
- [AI Web Capabilities](https://docs-ai.interop.io/docs/modules/ai-web/capabilities.md#participate-in-mcp-capability-flows)
- [io.Assist Capabilities](https://docs-ai.interop.io/docs/modules/io-assist-ng/capabilities.md#handle-sampling-and-elicitation-in-the-app)
- [MCP Core Tool Types](https://docs-ai.interop.io/docs/api-reference/mcp-core/tool-types.md)
- [Custom AI Web Guide](https://docs-ai.interop.io/guides/io-assist-anywhere/custom-ui-skin-using-ai-web.md)
