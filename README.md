# io.Intelligence Developer Kit

This repository contains the portable `io-intelligence` Agent Skill for developers building with [io.Intelligence](https://docs-ai.interop.io/).

The skill helps AI coding agents:

- choose the appropriate io.Intelligence packages and topology;
- integrate MCP, Working Context, AI Web, io.Assist, and AI Mastra Bridge;
- build custom assistant frontends and protocol-compatible backends;
- materialize official packaged, editable, and custom application templates;
- start, follow, understand, and troubleshoot the io.Assist Anywhere guide;
- investigate io.Intelligence integration and runtime problems using the developer's actual project.

The official documentation is the source of truth for public product behavior and APIs. The skill adds task routing, cross-package reasoning, implementation workflows, and diagnostic playbooks without copying the documentation.

## Install

Install the skill from this repository with the open Skills CLI:

```bash
npx skills add InteropIO/iointel-dev-kit --skill io-intelligence
```

To inspect the skills exposed by the repository before installing:

```bash
npx skills add InteropIO/iointel-dev-kit --list
```

The same skill is intended to work unchanged in Agent Skills-compatible coding agents.

## V1 Scope

V1 assumes that the installed skill, current official documentation, and locally available io.Intelligence packages describe the same product state. It does not detect package versions or select historical guidance.

The skill includes a deterministic materializer for five official templates:

- `io-assist-react-packaged`
- `io-assist-angular-packaged`
- `io-assist-react-editable`
- `io-assist-angular-editable`
- `ai-web-vanilla`

Template source remains outside the installed skill. The materializer retrieves exactly one selected directory from the immutable `V1.0` Git tag and records its provenance locally. AI coding agents should follow the skill's scaffolding workflow. To use the script directly from this repository:

```bash
node skills/io-intelligence/scripts/materialize-template.mjs --list
node skills/io-intelligence/scripts/materialize-template.mjs \
  --template io-assist-react-packaged \
  --target ./my-io-assist
```

The generated applications are io.Connect clients. Their manifests and framework configuration define their commands and local ports. Starting a standalone web process does not by itself verify integrated behavior in io.Connect Browser or io.Connect Desktop.

## Documentation

- [io.Intelligence documentation](https://docs-ai.interop.io/)
- [Machine-readable documentation map](https://docs-ai.interop.io/llms.txt)

## License

ISC
