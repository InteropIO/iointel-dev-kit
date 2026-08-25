# Vendored io.Assist React source

Everything under `src/io-assist/` is a copy of the `@interopio/io-assist-react`
library source, vendored so this template stays editable.

| | |
| --- | --- |
| Upstream repo | https://github.com/InteropIO/iointel-js |
| Upstream path | `libs/io-assist-react/src` |
| Upstream branch | `master` |
| Upstream commit | `49ec0ab9` ("Publish") |
| Library version | `1.1.2` |
| Synced on | 2026-08-25 |

## Re-syncing

Copy `libs/io-assist-react/src` from upstream over `src/io-assist/`, then
re-apply the deviations below and keep this file up to date. Also check
`libs/io-assist-react/package.json` for dependency bumps that need mirroring
into this template's `package.json` (`@interopio/ai-web`,
`@interopio/working-context`, `react-markdown`, `remark-gfm`, `zustand`, ...).

## Deviations from upstream

These are intentional and must survive every re-sync:

1. **`styles/index.css` — Inter font URL.** Upstream points `@font-face` at
   `./files/inter-latin-wght-normal.woff2`, which only exists in the library's
   built `dist/`. This template is a plain Vite app, so it resolves the woff2
   straight out of `node_modules` via
   `@fontsource-variable/inter/files/inter-latin-wght-normal.woff2`.

2. **`components/tool/ToolListItem.tsx` — jsx-a11y directive.** Upstream carries
   an `eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex` comment.
   `eslint-plugin-jsx-a11y` has no ESLint 10 support, so this template does not
   load it, and an unknown rule in a disable directive is a hard ESLint error.
   The directive is dropped; its rationale is kept as a plain comment.
