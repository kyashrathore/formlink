# REPO_CONTEXT

Last updated: 2025-09-23

## Overview of recent infra/codebase changes

- Supabase DB types now include two new tables to match `packages/db/supabase/schema.sql`:
  - `tool_connections` – global provider auth per user/toolkit.
  - `submission_action_logs` – sidecar mapping of actions per submission.
    Consumers can use:
  - `supabase.from("tool_connections")...`
  - `supabase.from("submission_action_logs").upsert(rows, { onConflict: "submission_id,action_log_id" })`.

- Next.js sitemap build resilience:
  - `apps/formcraft/app/sitemap.ts` now wraps the Notion fetch in `try/catch`.
  - On failure (e.g., CI without network), it logs a warning and returns static routes only.
  - Runtime blog pages continue to fetch normally.

- Type-check scope in `apps/formcraft/tsconfig.json`:
  - `.next` folder is excluded from type-checking to avoid transient generated types.

## Migrations strategy

We consolidated on a single canonical schema file:

- Source of truth: `packages/db/supabase/schema.sql`.
- Local dev reset command (root):
  - `pnpm db:hard-reset` – re-creates local Supabase, loads `schema.sql`, and notifies PgREST.
- Generated Types:
  - `pnpm db:gen-types` – writes to `packages/db/src/types/database.types.ts`.

Notes:

- Several historical migration files were removed from version control in favor of the single schema.
- For stateful environments, plan a one-time reset or manual DDL reconciliation when adopting the new schema.

## Turbo outputs

We added `turbo.json` with `build` outputs for both library (`dist/**`) and Next apps (`.next/**`) to improve cache behavior and silence output warnings.

## Linting adjustments

To unblock CI while type-hardening continues, both app ESLint configs treat unused vars as warnings, with `^_` naming to intentionally ignore args/vars. We will raise strictness once warnings are reduced.
