# io.Intelligence Developer Kit

This repository contains the portable `io-intelligence` Agent Skill for developers building with [io.Intelligence](https://docs-ai.interop.io/).

The skill helps AI coding agents:

- choose the appropriate io.Intelligence packages and topology;
- integrate MCP, Working Context, AI Web, io.Assist, and AI Mastra Bridge;
- build custom assistant frontends and protocol-compatible backends;
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

The planned scaffolder for packaged React, packaged Angular, editable React, editable Angular, and Vanilla JavaScript custom-mode applications is a later phase and is not included in this repository state. There is no scaffolding command.

Starting-point applications for those presets live in `templates/`, to be copied manually. Of these, `io-assist-react-editable` is the source-owned React fork: it carries the io.Assist React source at `src/io-assist` with provenance recorded in `src/io-assist/PROVENANCE.md`. `io-assist-angular-editable` is still an unfinished shell.

## Documentation

- [io.Intelligence documentation](https://docs-ai.interop.io/)
- [Machine-readable documentation map](https://docs-ai.interop.io/llms.txt)

## License

ISC
