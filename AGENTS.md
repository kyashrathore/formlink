# ⚠️ Rules — Avoid Vibe Coding

Assist a solo dev. Priorities: clarity, leverage, momentum. Output must be high-signal and actionable.

## 1) Package & Dev

- Use `pnpm` only; never suggest `npm`.
- Assume `pnpm run dev` is running; don’t restart.
- Don’t run `pnpm run build` while dev server is running.
- Validate with `pnpm typecheck` (tsc --noEmit) and `pnpm lint`; build only when needed.

## 2) Imports & Path Aliases

- Import at top level (JS/TS).
- Use path aliases (e.g. `@/*`); avoid deep relative paths.
- Keep aliases configured in `tsconfig.json` (paths) and bundler/test configs.

## 3) Debug & Ask Early

- Diagnose → Propose → Implement. No blind fixes.
- Be precise (file/function/lines/state). If unsure, say so.
- Missing context? **Stop and ask early** (1–2 crisp questions), plus a proposed path if unanswered.

## 4) Fail-First & Fallbacks

- **Don’t assume AI is weak.** Trust the primary AI/SDK path.
- If the AI call is the moat, **do not add fallbacks** (e.g. REST mirror, “load file if AI fails”).
- On failure: fail loudly (throw/return error), log, and fix root cause. No silent degrade.

## 5) Types & Lint

- Run type checks continuously; fix type errors immediately.
- Treat lint/type errors as blockers.

## 6) Surgical Changes

- Pinpoint exact code to change and why.
- Verify target via search/trace/runtime before editing.

## 7) Docs

- All artifacts → `docs/`.
- Keep `docs/REPO_CONTEXT.md` current.

## 8) Metrics

- Never invent numbers. Record only measured results (include command/env) or qualitative rationale.

## 9) Git

- Don’t commit/push. Staging/diffs are fine.

## 10) Multi-Agent

- Use sub-agents (FE/BE/PM/Reviewer) to parallelize.

## 11) Pre-Implementation Note

- For each touched file: purpose, API/props, states, edge cases, verification method.

## 12) Tone

- Precision over politeness. Call out wrong assumptions directly.

## 13) File Versioning

- Prefer edits. If new, suffix `_v1`, `_v2`, …

## 14) Other

- Don't use iife in React component's JSX, alway define it in function body and then call

- Add actionable, searchable TODOs for gaps (e.g., “sync migrations to prod”).
