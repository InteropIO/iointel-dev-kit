# io.Assist React — editable (source-owned)

A React + TypeScript + Vite application that embeds io.Assist as **editable source** rather than as an
npm dependency. The io.Assist React source lives in [`src/io-assist`](src/io-assist), and you own it.

If you only need configuration-level customization, prefer the packaged preset
(`io-assist-react-packaged`) — it consumes `@interopio/io-assist-react` and stays on the upgrade path.
This template is the deliberate fork: see [`src/io-assist/PROVENANCE.md`](src/io-assist/PROVENANCE.md)
for its origin, version, and the one-way ownership contract.

## Prerequisites — read this first

This application **cannot run on its own**. Opening the dev server URL directly will fail. Two external
pieces are required:

1. **An io.Connect Browser Platform.** `src/App.tsx` uses `@interopio/browser`, which is a *client*: it
   discovers a platform peer and does not create one. With no platform, `initIoConnect` fails and — by
   design — io.Assist never initializes (`src/io-assist/hooks/useIoAiWebBootstrap.ts` returns early
   unless io.Connect is ready, and `src/io-assist/actions/initIoAiWeb.ts` throws without the io.Connect
   API). The symptom is `io.Connect initialisation failed` in the console.

   Any application built with `@interopio/browser-platform` can host it. This app must then be
   registered in that platform's `applications.local` config and **launched from the platform**, not
   opened directly.

   Alternatively, replace `@interopio/browser` with `@interopio/browser-platform` in `src/App.tsx` to
   make this app self-hosting.

2. **An agent server** implementing the Agent Protocol, reachable over HTTP.

## Configure

Set the agent server URL in [`src/App.tsx`](src/App.tsx):

```ts
const AGENT_SERVER_URL = 'http://localhost:4111'; // ships empty — you must set this
```

It ships as `''`, which **fails validation** — AI Web requires a valid URL — so the assistant will not
start until you set it.

While you're there, `dynamicConfig.user` is a placeholder (`acme-advisor`); replace it with your real
user identity.

## Run

```bash
npm install
npm start        # dev server on http://localhost:4104
```

Then launch this app **from your io.Connect Browser Platform**, not by visiting `:4104` directly.

### Local development against the iointel-js monorepo

If you have the `iointel-js` monorepo checked out alongside this template, it supplies both
prerequisites:

```bash
# terminal 1 — platform (io.Connect Home)
cd iointel-js/dev-apps/d-io-cb-home && npm start     # http://localhost:4200

# terminal 2 — agent server (Mastra)
cd iointel-js/apps/io-assist-mastra && npm start     # http://localhost:4111

# terminal 3 — this app
npm start                                            # http://localhost:4104
```

Register this app in `iointel-js/configs/io-connect/io-cb-config-rich.json` under `apps`:

```json
{
  "name": "io-assist-react-editable",
  "type": "window",
  "details": {
    "url": "http://localhost:4104",
    "channelSelector": { "enabled": true, "type": "single" }
  },
  "customProperties": { "includeInWorkspaces": true }
}
```

Then open the platform at `http://localhost:4200` and launch `io-assist-react-editable` from its app
list. The platform needs its own license keys via its `create-local-env` step.

## Confirming the fork is live

With the dev server running, edit `SUBTITLE` in
[`src/io-assist/constants/uiStrings.ts`](src/io-assist/constants/uiStrings.ts) and save. The welcome
screen updates via HMR without a reload — only possible because the source is in `src/`. Breakpoints in
`src/io-assist/**` hit real TypeScript with sourcemaps, not bundled `dist`.

## Editing the io.Assist source

| Area | Location |
|---|---|
| Root component | `src/io-assist/IoAssist.tsx` |
| Public surface | `src/io-assist/index.ts` |
| UI components | `src/io-assist/components/**` |
| State (Zustand slices) | `src/io-assist/stores/**` |
| Side effects / SDK adapters | `src/io-assist/actions/**` |
| Styles and theme tokens | `src/io-assist/styles/**` |
| User-facing strings | `src/io-assist/constants/uiStrings.ts` |

Change the smallest coherent area, and avoid bypassing the AI Web and Agent Protocol contracts to achieve
a UI-only customization.

Two things about this directory are load-bearing:

- **Tailwind v4 is required.** `src/io-assist/styles/index.css` uses `@import 'tailwindcss'` and
  `@theme`, so `@tailwindcss/vite` is in `vite.config.ts`. Tailwind scans `src/`, which is what makes the
  vendored layout work.
- **`src/io-assist/index.ts` imports its own stylesheet**, so `src/index.css` must not import it again.

`eslint.config.js` downgrades three rules to warnings inside `src/io-assist/**` — upstream does not
enforce them, and the directory is kept diffable against its source. See the comment there.

## Scripts

| | |
|---|---|
| `npm start` | dev server with HMR on port 4104 |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | ESLint |
| `npm run preview` | serve the production build |
