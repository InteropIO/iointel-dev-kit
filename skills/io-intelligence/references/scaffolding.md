# Template Scaffolding

## Use this reference when

Use when a developer wants to create, scaffold, materialize, or start from an official io.Intelligence application template.

## Delivery model

The installed skill contains a compact template catalog and a dependency-free materializer. The template source is not bundled into the skill. The materializer retrieves exactly one selected directory from the public `InteropIO/iointel-dev-kit` repository at the immutable Git tag recorded in the catalog.

Use the script instead of manually cloning, downloading, or reconstructing template files:

```bash
node <skill-directory>/scripts/materialize-template.mjs --list
node <skill-directory>/scripts/materialize-template.mjs --template <template-id> --target <path>
```

Resolve `<skill-directory>` to the directory containing this skill's `SKILL.md`. The target must be absent or empty. Node.js 18 or newer and Git are required.

## Available templates

| Template ID | Choose when |
| --- | --- |
| `ai-web-vanilla` | The developer wants a framework-free custom assistant UI built directly on AI Web. |
| `io-assist-angular-editable` | The developer wants an Angular io.Assist application whose assistant source they own and can change. |
| `io-assist-angular-packaged` | The developer wants an Angular application using the published io.Assist package. |
| `io-assist-react-editable` | The developer wants a React io.Assist application whose assistant source they own and can change. |
| `io-assist-react-packaged` | The developer wants a React application using the published io.Assist package. |

If the requested delivery is ambiguous, establish the framework and choose packaged, editable, or custom mode before retrieving anything.

## Materialization workflow

1. Read this reference and the smallest task-specific reference for packaged io.Assist, editable io.Assist, or custom AI Web.
2. Select exactly one template ID.
3. Confirm the target is absent or empty. Do not overwrite an existing project.
4. Run the bundled materializer with that template ID and target.
5. If retrieval fails, report the failure and its evidence. Do not approximate the template from memory, copy another preset, or fetch from a branch.
6. Work only in the materialized target. Do not inspect or download the other template directories unless the user separately asks to compare templates.
7. Read the materialized manifest, lockfile, framework configuration, and relevant source before changing anything.
8. Locate `AGENT_SERVER_URL` in the materialized source. It intentionally ships as an empty string. Obtain a valid URL from the user or existing project/environment evidence and set it to the LLM agentic backend that implements the io.Intelligence Agent Protocol. Do not invent a URL or silently retain the empty value.
9. When the task requires it, install dependencies with the package manager indicated by the materialized project.
10. Discover the available start and build commands and configured development port from the materialized project. Do not assume command names or ports and do not invent a missing build command.
11. Apply requested project-specific changes using the coding agent's normal tools and the official documentation for public APIs.

The materializer only retrieves source and records provenance. It does not install dependencies, start the application, run a build, register an io.Connect app, or validate project behavior.

`AGENT_SERVER_URL` is a blocking startup prerequisite for every V1 template. Do not start the application until it contains a valid backend URL. Building the project may still be useful before that value is available, but build success does not establish backend connectivity.

## io.Connect execution boundary

Every V1 template is an io.Connect client. A standalone web process listening on its development port is therefore not sufficient evidence that the application behaves correctly inside io.Connect.

After discovering the project's scripts and platform configuration:

- if the agent can establish the correct io.Connect Browser or io.Connect Desktop launch and application-registration flow from available knowledge and project evidence, it may launch the app in that environment and inspect behavior;
- if the agent cannot establish that flow, it may verify only the evidence it can obtain, such as dependency installation, a declared build, or a development process starting successfully;
- in the latter case, explicitly state that io.Connect-integrated behavior was not inspected. Do not describe a listening process as a behavioral verification.

Choose validation based on the task, project, available tools, and user instructions. This boundary limits unsupported claims; it is not a universal test checklist imposed by the skill.

For current platform-specific app discovery and launch behavior, consult the official [io.Connect Browser App Management](https://docs.interop.io/browser/capabilities/app-management/index.html) or [io.Connect Desktop App Configuration](https://docs.interop.io/desktop/developers/configuration/application/index.html) documentation as applicable. Use the materialized project's evidence to decide which platform applies; do not assume that starting a generic web URL reproduces the io.Connect launch flow.

## Provenance and ownership

The materializer writes `.io-intelligence-template.json` at the target root. Keep it unless the user explicitly asks to remove it. It records the selected template, repository, immutable tag, source path, framework, mode, and materialization time.

All generated applications become local project source. Editable io.Assist templates are explicitly one-way, customer-owned forks: no automatic upstream merge or update promise is implied. Packaged templates continue to consume published io.Assist packages through their normal dependencies.

The catalog's tag is the complete template source identity for V1. Do not override it, replace it with a branch, or assume that a similarly named tag has equivalent content.
