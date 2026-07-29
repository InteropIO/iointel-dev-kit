# io.Assist Anywhere Guide Companion

## Contents

- [Use this reference when](#use-this-reference-when)
- [Source and repository contract](#source-and-repository-contract)
- [How to help a user get started](#how-to-help-a-user-get-started)
- [Track the learner's current state](#track-the-learners-current-state)
- [Chapter map](#chapter-map)
- [Topology evolution](#topology-evolution)
- [Answer questions during the guide](#answer-questions-during-the-guide)
- [Help a user get unstuck](#help-a-user-get-unstuck)
- [Common guide-wide problems](#common-guide-wide-problems)
- [Official sources](#official-sources)

## Use this reference when

Use when the user mentions:

- the [io.Assist Anywhere guide](https://docs-ai.interop.io/guides/io-assist-anywhere);
- an io.Assist Anywhere chapter;
- the ACME Banking sample;
- `iointel-guides`;
- `io-assist-anywhere-start`;
- `io-assist-anywhere-solution`;
- difficulty following or completing the guide.

Support three modes:

1. **Getting started** — establish prerequisites, obtain the starter, and begin at the correct entry point.
2. **Guide companion** — answer questions in the context of the learner's current chapter and framework path.
3. **Unblocking** — inspect the learner's actual guide checkout, identify the first failed chapter boundary, and help repair it without erasing their progress.

## Source and repository contract

Use these authorities:

1. The current official guide chapter is the authority for the learner's next steps.
2. The official API pages linked by that chapter define exact public APIs.
3. The learner's `io-assist-anywhere-start` checkout shows their actual progress and errors.
4. The public `io-assist-anywhere-solution` is a completed reference, not a directory to copy wholesale.

Guide text:

- [io.Assist Anywhere](https://docs-ai.interop.io/guides/io-assist-anywhere)
- [Machine-readable chapter map](https://docs-ai.interop.io/llms.txt)

Runnable code:

- [InteropIO/iointel-guides](https://github.com/InteropIO/iointel-guides)
- `io-assist-anywhere-start/` — the learner's working project
- `io-assist-anywhere-solution/` — completed reference
- `agentic-backend/` — separate Mastra backend shared by the guide flow

Never place real license keys or model-provider keys in committed files. Use the supplied `.env-template` files as the shape for local `.env` files.

## How to help a user get started

When the user asks to start the guide:

1. Read the [Introduction](https://docs-ai.interop.io/guides/io-assist-anywhere.md) and [Prerequisites](https://docs-ai.interop.io/guides/io-assist-anywhere/prerequisites.md).
2. Establish whether the user already cloned `InteropIO/iointel-guides`.
3. Confirm the prerequisites relevant to the next chapter:
   - Git;
   - npm;
   - a compatible Node.js version;
   - modern browser and editor;
   - io.Connect Browser license;
   - io.Intelligence license;
   - Anthropic API key before agent-backend chapters.
4. Direct all learner edits to `io-assist-anywhere-start`, not the solution.
5. Keep `agentic-backend` separate from the frontend Lerna package.
6. Follow [Chapter 1](https://docs-ai.interop.io/guides/io-assist-anywhere/setting-up-the-project.md) for cloning, environment files, installation, startup, and the initial workspace.
7. Ask the user to identify whether they plan to follow the React path, Angular path, or both when Chapter 4 is reached. Do not force that choice earlier.

The backend is not required for the first visual inspection of the starting workspace, but it must be configured before the assistant chapters.

## Track the learner's current state

Before answering a chapter-specific question or changing guide code, establish:

```text
checkout path:
current chapter:
last completed chapter checkpoint:
React, Angular, or both:
frontend process state:
backend process state:
exact command and working directory:
first error or incorrect observation:
local changes since the last successful checkpoint:
```

Infer these from the project when possible. Ask only for information that cannot be observed.

Do not assume the learner's files match either the untouched starter or the final solution. Read their current files and diff first.

## Chapter map

### Introduction and prerequisites

Purpose:

- understand the ACME Banking story and final result;
- obtain licenses, tools, and the model-provider key;
- understand the start, solution, and backend directories.

Read:

- [Introduction](https://docs-ai.interop.io/guides/io-assist-anywhere.md)
- [Prerequisites](https://docs-ai.interop.io/guides/io-assist-anywhere/prerequisites.md)

### Chapter 1: Setting up the project

Purpose:

- clone the public guide repository;
- configure local environment files;
- install dependencies;
- start the frontend applications and backend as directed;
- inspect the initial `client-management` workspace.

Key boundary:

- Open the platform at `http://localhost:4200`; opening a child app directly does not reproduce its io.Connect-hosted behavior.

Read [Chapter 1](https://docs-ai.interop.io/guides/io-assist-anywhere/setting-up-the-project.md).

### Chapter 2: MCP Web integration

Purpose:

- start MCP Web as an io.Connect Browser platform plugin;
- expose the platform-owned `getClients` interop method as a static `get_clients` MCP tool.

Key boundary:

- The interop method remains the underlying capability. Static MCP configuration maps the tool to it.

Read [Chapter 2](https://docs-ai.interop.io/guides/io-assist-anywhere/mcp-web-integration.md) and [mcp-integration.md](mcp-integration.md).

### Chapter 3: Configure the agent backend

Purpose:

- add AI Mastra Bridge to `agentic-backend`;
- register the `/io-bridge` routes;
- expose agent discovery, threads, streaming runs, and frontend tool results.

Key boundary:

- Run the backend from its own package. Starting the frontend package does not start Mastra.

Read [Chapter 3](https://docs-ai.interop.io/guides/io-assist-anywhere/configure-agent-backend.md) and [mastra-backend.md](mastra-backend.md).

### Chapter 4: Create io.Assist

Purpose:

- choose React, Angular, or both;
- initialize io.Connect inside the assistant app;
- configure the agent backend and MCP Web client;
- render the ready-made io.Assist UI with a guide user.

Key boundary:

- Preserve the framework-specific integration: React uses component props; Angular uses the provider plus dynamic component config.

Read [Chapter 4](https://docs-ai.interop.io/guides/io-assist-anywhere/create-io-assist.md) and [packaged-io-assist.md](packaged-io-assist.md).

### Chapter 5: Add Working Context

Purpose:

- describe the selected client through a Working Context schema;
- make the assistant aware of the current workspace client.

Key boundary:

- Prove the real workspace context path and value before attributing missing context to the assistant.

Read [Chapter 5](https://docs-ai.interop.io/guides/io-assist-anywhere/add-working-context.md) and [working-context.md](working-context.md).

### Chapter 6: Update application definitions

Purpose:

- enrich application captions and interop/context metadata;
- enrich workspace description and context schema;
- make system application and workspace discovery meaningful.

Key boundary:

- Running applications and registered methods are not sufficient for system search; discovery metadata is a separate input.

Read [Chapter 6](https://docs-ai.interop.io/guides/io-assist-anywhere/updating-app-definitions.md) and [diagnose-mcp.md](diagnose-mcp.md).

### Chapter 7: Add MCP Apps

Purpose:

- enable the MCP App UI capability;
- configure the sandbox proxy;
- use the Workspace Widget interactive tool.

Key boundary:

- The feature needs server UI metadata, client capability, resource access, sandbox proxy, and a host display surface.

Read [Chapter 7](https://docs-ai.interop.io/guides/io-assist-anywhere/add-support-for-mcp-apps.md) and [mcp-apps.md](mcp-apps.md).

### Chapter 8: Move MCP Web into io.Assist

Purpose:

- remove the external Browser-platform MCP Web server;
- host MCP Web inside the assistant application.

Key boundary:

- This intentionally changes the Chapter 2 topology. Do not keep both server owners unless the chapter explicitly directs it.

Read [Chapter 8](https://docs-ai.interop.io/guides/io-assist-anywhere/remove-external-mcp-web-server.md) and [mcp-integration.md](mcp-integration.md).

### Chapter 9: Extend to io.Connect Desktop

Purpose:

- run the guide flow in Desktop;
- introduce the hidden MCP Web host app required by that topology.

Key boundary:

- Distinguish Browser and Desktop application definitions, factories, and host lifecycles.

Read [Chapter 9](https://docs-ai.interop.io/guides/io-assist-anywhere/extend-for-io-connect-desktop.md).

### Chapter 10: Dedicated Desktop MCP HTTP server

Purpose:

- move Desktop MCP capability into a dedicated local MCP HTTP server;
- connect the assistant to it through Streamable HTTP.

Key boundary:

- MCP HTTP is a local server for the user's Desktop runtime, and it runs separately from the browser apps and Mastra backend.

Read [Chapter 10](https://docs-ai.interop.io/guides/io-assist-anywhere/dedicated-io-connect-desktop-mcp-http-server.md) and [mcp-integration.md](mcp-integration.md).

### Chapter 11: Custom UI with AI Web

Purpose:

- use the pre-scaffolded Vanilla/TypeScript custom assistant shell;
- initialize AI Web directly;
- implement streaming, tool traces, Working Context, MCP Apps, sampling, and elicitation without io.Assist UI.

Key boundary:

- AI Web supplies the runtime; the guide app owns the UI and event-state reduction.

Read [Chapter 11](https://docs-ai.interop.io/guides/io-assist-anywhere/custom-ui-skin-using-ai-web.md), [custom-ai-web.md](custom-ai-web.md), and [sampling-elicitation.md](sampling-elicitation.md).

### Chapter 12: Conclusion

Purpose:

- review the completed topology and capabilities;
- identify appropriate next steps without changing the completed guide contract.

Read [Chapter 12](https://docs-ai.interop.io/guides/io-assist-anywhere/conclusion.md).

## Topology evolution

Keep this sequence in mind:

```text
Chapter 2
MCP Web server in the io.Connect Browser platform

Chapter 4
React/Angular io.Assist connects as the frontend and MCP client

Chapter 8
MCP Web server moves from the platform into the assistant apps

Chapter 9
Desktop adds a hidden MCP Web host application

Chapter 10
Desktop MCP moves into a dedicated local MCP HTTP server

Chapter 11
A custom AI Web frontend demonstrates direct runtime ownership
```

When diagnosing, compare the learner's current topology with the current chapter, not with the final solution. Code that is correct in Chapter 10 can be premature or contradictory in Chapter 2.

## Answer questions during the guide

For every guide question:

1. Identify the current chapter and chosen framework path.
2. Read the exact chapter before answering.
3. Read only the official API pages and skill references used by that chapter.
4. Inspect the learner's current files when the answer depends on their implementation.
5. Separate:
   - what the chapter asks the learner to do;
   - why the io.Intelligence architecture requires it;
   - how the exact public API is shaped today.
6. Keep the answer local to the current checkpoint unless the user asks about later architecture.
7. Explain when a later chapter intentionally replaces the current topology.

Do not paste the chapter back to the user. Point to the exact section, explain the missing reasoning, and adapt it to their observed state.

## Help a user get unstuck

Use this investigation order:

1. Record the current chapter, framework path, and last successful checkpoint.
2. Capture the exact failing command, working directory, error, and runtime symptom.
3. Inspect local changes without discarding them.
4. Re-read the chapter section containing the failed checkpoint.
5. Classify the failing boundary:
   - prerequisites or environment;
   - dependency installation or build;
   - io.Connect platform/application lifecycle;
   - MCP server/client topology;
   - Agent Protocol backend;
   - React/Angular io.Assist integration;
   - Working Context;
   - application/workspace discovery metadata;
   - MCP Apps;
   - Desktop or MCP HTTP;
   - custom AI Web event handling.
6. Load the matching diagnostic reference.
7. Find the first failed causal stage and explain the smallest repair.
8. Preserve earlier chapter work and the user's framework choice.
9. Use the solution only to compare the relevant area; remember it contains later-chapter changes.
10. Return the learner to the current chapter's documented checkpoint.

Do not replace the learner's whole project with the solution and do not skip them forward to hide an unresolved checkpoint.

## Common guide-wide problems

| Symptom | First evidence |
| --- | --- |
| Platform opens but workspace apps do not behave | Confirm the user opened `http://localhost:4200`, then inspect platform registration and workspace definition |
| Child app works directly but not in workspace | Inspect io.Connect initialization and the hosted app context |
| `get_clients` is absent | Identify current chapter's MCP server owner, underlying `getClients` method, client connection, and `listTools` |
| Backend routes are missing | Confirm `agentic-backend` is running separately and bridge routes are registered |
| Agent list is empty or unauthorized | Inspect `/io-bridge/agents`, auth headers, and agent registration |
| io.Assist is blank or unstyled | Check framework bootstrap, required styles, host dimensions, and AI Web initialization |
| Selected client is absent from assistant context | Inspect workspace context first, then Working Context schema and AI Web config |
| Applications/workspaces are not discoverable | Inspect captions, interop metadata, workspace description/schema, system tool config, and client capabilities |
| Workspace Widget does not render | Trace UI tool metadata, client UI capability, resource, proxy, and display mode |
| Desktop chapter starts the wrong MCP server | Compare the implementation with the topology evolution above |
| Custom UI receives events but renders incorrectly | Capture raw Agent Protocol events, then inspect the local event reducer |

Follow the checks already defined by the current official chapter. Do not add a separate skill-wide test contract.

## Official sources

- [Guide home](https://docs-ai.interop.io/guides/io-assist-anywhere)
- [Guide repository](https://github.com/InteropIO/iointel-guides)
- [Documentation index](documentation-index.md#ioassist-anywhere-guide)
- [Framework introduction](https://docs-ai.interop.io/index.html.md)
