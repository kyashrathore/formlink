# Internal Additive Specs (Codegen Harness)

> Internal use only. Do not index from main docs.

## 0.0 Provisioned Sandbox & Execution Context

- Environment: Vercel sandbox with full permissions. The orchestrator provisions everything before this spec is invoked; operate non‑interactively without prompting for confirmations.
- Pre‑provisioned (handled programmatically before Codex runs):
  - Fresh sandbox created and this repo cloned.
  - Bun installed and `bun install` executed.
  - Dev server started (`bun run dev`) with logs streaming to `.logs/bun-dev.log`.
  - Codex CLI launched with this specification and a user prompt.
- Scope: Generate/modify code and use the validation harness in 0.3. Do not repeat provisioning steps (no sandbox creation, cloning, Bun install, or dev‑server boot) unless explicitly requested.
- Draft constraint: Avoid production builds during draft; builds may interfere with dev‑server files.

## 0. Quickstart (Harness‑specific)

Install (Bun preferred; fallback by lockfile)

- bun add @formlink/runtime react react-dom
- Fallback (detect installer):
  - If `.pnpm-lock.yaml` exists → `pnpm add @formlink/runtime react react-dom`
  - Else if `package-lock.json` exists → `npm install @formlink/runtime react react-dom`
  - Else if `yarn.lock` exists → `yarn add @formlink/runtime react react-dom`
  - Else default to Bun.

CSS & Tailwind

- Option A — Vite/SPA: in `src/main.tsx` add `import '@formlink/runtime/ui/react/style.css'`.
- Option B — Next.js App Router: in `app/layout.tsx` add `import '@formlink/runtime/ui/react/style.css'`.
- Option C — Tailwind v4 scanning (if consuming runtime UI from npm): in `tailwind.config.{ts,js}` use:
  - content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@formlink/runtime/**/*.{js,ts,jsx,tsx}'
    ]

## 0.3 Dev Workflow (lint, types, run, logs)

- Types: `bun run lint:tsc`
- Lint/Fix (Biome + type check): `bun run lint`
- E2E sanity (headless): `bun run test:e2e:ci` (visits `/`; starts server only if not already running)
- Inspect logs for client/runtime errors:
  - `rg -n "(Error|Uncaught|TypeError|ReferenceError)" .logs/bun-dev.log || true`
  - If needed: `tail -n 200 .logs/bun-dev.log`
- If errors appear, fix wiring (imports, providers, runtime creation, route binding, component code) and repeat from Types.

Optional

- Restart dev server only if required (e.g., crashed or configuration changed): `bun run dev` (clears `.logs/bun-dev.log`). Avoid unnecessary restarts during draft.

Notes

- Prefer `bunx` for Playwright; fall back to `pnpx`/`npx` when necessary. Browser binaries are typically provisioned; if missing, run `bun run playwright:install`.
- Logs live at `.logs/bun-dev.log` and are cleared by `dev` and `test:e2e:ci` scripts. Manual clear: `bun run logs:clear`.
- Do not run a production `build` during draft.
