# io.Assist Angular — editable (source-owned)

An Angular application that embeds io.Assist as **editable source** rather than as an npm dependency.
The io.Assist Angular source lives in [`src/app/io-assist`](src/app/io-assist), and you own it.

If you only need configuration-level customization, prefer the packaged preset
(`io-assist-angular-packaged`) — it consumes `@interopio/io-assist-ng` and stays on the upgrade path.
This template is the deliberate fork: see [`src/app/io-assist/PROVENANCE.md`](src/app/io-assist/PROVENANCE.md)
for its origin, version, and the one-way ownership contract.

## Prerequisites — read this first

This application **cannot run on its own**. Opening the dev server URL directly will fail. Two external
pieces are required:

1. **An io.Connect Browser Platform.** `src/app/app.config.ts` uses `@interopio/browser`, which is a
   *client*: it discovers a platform peer and does not create one. With no platform, io.Connect
   initialization fails and — by design — io.Assist never starts
   (`src/app/io-assist/shared/services/io/io.service.ts` waits for io.Connect readiness before doing
   anything else).

   Any application built with `@interopio/browser-platform` can host it. This app must then be
   registered in that platform's `applications.local` config and **launched from the platform**, not
   opened directly.

2. **An agent server** implementing the Agent Protocol, reachable over HTTP.

## Configure

Set the agent server URL in [`src/app/app.config.ts`](src/app/app.config.ts):

```ts
const AGENT_SERVER_URL = 'http://localhost:4111'; // ships empty — you must set this
```

It ships as `''`, which **fails validation** — AI Web requires a valid URL — so the assistant will not
start until you set it.

While you're there, `dynamicConfig.user` in [`src/app/app.ts`](src/app/app.ts) is a placeholder
(`acme-advisor`); replace it with your real user identity.

## Run

```bash
npm install
npm start        # dev server on http://localhost:4103
```

Then launch this app **from your io.Connect Browser Platform**, not by visiting `:4103` directly.

### Local development against the iointel-js monorepo

If you have the `iointel-js` monorepo checked out alongside this template, it supplies both
prerequisites:

```bash
# terminal 1 — platform (io.Connect Home)
cd iointel-js/dev-apps/d-io-cb-home && npm start     # http://localhost:4200

# terminal 2 — agent server (Mastra)
cd iointel-js/apps/io-assist-mastra && npm start     # http://localhost:4111

# terminal 3 — this app
npm start                                            # http://localhost:4103
```

Register this app in `iointel-js/configs/io-connect/io-cb-config-rich.json` under `apps`:

```json
{
  "name": "io-assist-angular-editable",
  "type": "window",
  "details": {
    "url": "http://localhost:4103",
    "channelSelector": { "enabled": true, "type": "single" }
  },
  "customProperties": { "includeInWorkspaces": true }
}
```

Then open the platform at `http://localhost:4200` and launch `io-assist-angular-editable` from its app
list. The platform needs its own license keys via its `create-local-env` step.

## Confirming the fork is live

With the dev server running, edit `UI_STRINGS` in
[`src/app/io-assist/shared/constants/ui-strings.ts`](src/app/io-assist/shared/constants/ui-strings.ts)
and save. The change picks up via HMR without a reload — only possible because the source is in `src/`.
Breakpoints in `src/app/io-assist/**` hit real TypeScript with sourcemaps, not a bundled library.

## Editing the io.Assist source

| Area | Location |
|---|---|
| Root component | `src/app/io-assist/io-assist.component.ts` |
| Public surface | `src/app/io-assist/index.ts` |
| Provider setup | `src/app/io-assist/io-assist.providers.ts` |
| Static/dynamic config + validation | `src/app/io-assist/io-assist.config.ts`, `io-assist.schema.ts` |
| UI components | `src/app/io-assist/components/**` |
| State (NgRx store) | `src/app/io-assist/shared/store/**` |
| Side effects / SDK adapters | `src/app/io-assist/shared/services/**` |
| Shared UI primitives | `src/app/io-assist/shared/components/**` |
| Styles and theme tokens | `src/app/io-assist/styles.css`, `src/app/io-assist/shared/styles/**` |
| User-facing strings | `src/app/io-assist/shared/constants/ui-strings.ts` |

Change the smallest coherent area, and avoid bypassing the AI Web and Agent Protocol contracts to achieve
a UI-only customization.

Two things about this directory are load-bearing:

- **Tailwind v4 is required.** `src/app/io-assist/styles.css` uses `@import 'tailwindcss'`, so
  `@tailwindcss/postcss` is registered in `.postcssrc.json` at the project root — Angular's application
  builder picks up PostCSS config files automatically. Tailwind scans the project for utility classes,
  which is what makes the vendored layout work.
- **`src/styles.css` imports `./app/io-assist/styles.css`** instead of
  `@interopio/io-assist-ng/styles.css`.

`*.spec.ts` test files were intentionally not vendored — see
[`src/app/io-assist/PROVENANCE.md`](src/app/io-assist/PROVENANCE.md) for the full list of deviations
from upstream.

## Scripts

| | |
|---|---|
| `npm start` | dev server with HMR on port 4103 |
| `npm run build` | `ng build` |
| `npm run watch` | `ng build --watch --configuration development` |
| `npm test` | unit tests (Vitest) |
