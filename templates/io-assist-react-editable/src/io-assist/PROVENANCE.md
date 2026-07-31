# io.Assist React — vendored source provenance

This directory is a **materialized copy of the io.Assist React source**, placed here so the
application owns it outright and can be edited at source level.

## Origin

| | |
|---|---|
| Framework | React |
| Source repository | `InteropIO/iointel-js` (https://github.com/InteropIO/iointel-js) |
| Source path | `libs/io-assist-react/src` |
| Ref | `master` |
| Commit | `4c3ccd3867dc38477c23d0edd2d4ca0dc2797da4` (2026-07-29) |
| Source package | `@interopio/io-assist-react` |
| Package version | `1.0.2` |
| `@interopio/ai-web` version | `1.1.2` |
| Materialized | 2026-07-30 |
| Preset | editable React (`io-assist-react-editable`) |

## Ownership

**This source is customer-owned.** It is a one-way fork:

- local changes need not remain equivalent to future io.Assist versions;
- automatic upstream merges are not promised;
- this is not a theme, plugin, or supported extension point.

If you need to stay on the upgrade path instead, use the packaged preset
(`@interopio/io-assist-react` consumed as a dependency) and customize through static/dynamic
configuration, prompts, MCP/context/backend configuration, host layout, and the supported styling
boundaries.

## Deviations from upstream

The tree is byte-identical to the source path at the commit above, with **one addition**:

- `styles/files/inter-latin-wght-normal.woff2` — added here.

  Upstream, `styles/index.css` declares `@font-face { src: url('./files/inter-latin-wght-normal.woff2') }`,
  but that binary is not in the source tree: the library's `vite.config.ts` copies it out of
  `@fontsource-variable/inter` into `dist/files` at package build time. Vendoring the raw source
  therefore leaves a dangling reference, so the file is committed alongside the CSS that needs it.
  This is why `@fontsource-variable/inter` is *not* a dependency of this application — nothing in the
  source imports it, the font arrives only through that `url()`.

  Inter (via `@fontsource-variable/inter@5.2.8`) is licensed under the SIL Open Font License 1.1.

No import paths were rewritten. The source uses relative imports throughout and no `@/` path alias,
so it drops in unmodified.

## How this connects to the application

- `src/App.tsx` imports `IoAssist`, `IoAssistStaticConfig`, `IoAssistDynamicConfig` from `./io-assist`.
- `index.ts` here imports `./styles/index.css` itself, so the application's `src/index.css` must **not**
  also import it.
- The styles are **Tailwind v4** (`@import 'tailwindcss'` + `@theme`), so `@tailwindcss/vite` is
  required in the application's `vite.config.ts`. Tailwind's source detection scans `src/`, which is
  what makes the vendored layout work.

## Architecture worth understanding before changing things

AI Web initialization and lifetime; static vs dynamic configuration; agent, thread and message state;
run and streaming event reduction; frontend and server tool traces; sampling and elicitation UI; MCP App
inline and workspace lifecycle; Working Context presentation; persistence and user scoping; the React
context/store wiring in `context/` and `stores/`.

Change the smallest coherent area, and avoid bypassing the AI Web and Agent Protocol contracts to
achieve a UI-only customization.

## Official documentation

- [io.Assist Overview](https://docs-ai.interop.io/modules/io-assist-ng/overview.md)
- [React API](https://docs-ai.interop.io/api-reference/io-assist-react/overview.md)
- [AI Web Overview](https://docs-ai.interop.io/modules/ai-web/overview.md)
- [Agent Protocol](https://docs-ai.interop.io/api-reference/ai-server/agent-protocol.md)
