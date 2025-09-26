# REPO_CONTEXT

Last updated: 2025-09-23

## Overview of recent infra/codebase changes

- Centralized AI prompts:
  - New package `@formlink/prompts` with `md/` templates and a strict `loadPrompt(id, params)` renderer using `{{var}}` slots. No string concatenation at call sites; pass all dynamic values via params. See usage in RI system and summaries.
  - Next apps transpile this package (see `next.config.ts`).
  - Reusable guard rules live in `packages/prompts/md/_guards.md` and are injected into templates via `{{guards}}`. All system prompts should start with:

    `You MUST adhere to the following guards:` then `{{guards}}` on the next line.

  - New templates used by the create‑form flow:
    - `form/enhanced-metadata.md` → returns `{ title, description, questionDetails[], journeyScript }` for the first phase.
    - `form/question-schema.md` → per‑question schema generation.

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

### UI Refactor: ResponseViewPlan Setup Dialog

- Split `apps/formcraft/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialog.tsx` into smaller parts for readability and maintainability.
- New files under `.../ResponseViewPlan/SetupDialogParts/`:
  - `helpers.ts` — shared utilities (path get/set, flatten, token helpers, Sheets range parsing, `finalizeSuggestion`).
  - `IncludedActionsList.tsx` — status + toolkit + included actions list.
  - `AuthSteps.tsx` — Composio OAuth 2-step UI and logic.
  - `ParamsConfigurator.tsx` — schema-driven params UI, AI suggestion, mapping, and save flow.
- `SetupDialog.tsx` now orchestrates state and renders the three parts. The previous inlined params UI is disabled (kept as a commented legacy block for reference) and replaced by `ParamsConfigurator`.
- No behavior changes intended; validated with `pnpm type-check` and `pnpm lint --filter=formcraft`.

### Response Intelligence: Filter Encoding + Backend Support

- RI system prompt now documents filter encoding for both primitives and advanced operators.
  - Primitives: equality (scalar) and inclusion (array of scalars) for `answer_filters`; scalar and array for `status` in `submission_filters`.
  - Timestamps: `created_at`/`completed_at` accept `{ since?, before?, between?: [start,end] }` (ISO strings).
  - Advanced operators for answer filters: `{ eq, in|includes, all, contains, gte, lte, gt, lt, between }`.
- Backend updates:
  - `/api/responses` no longer coerces `status` arrays to a single value.
  - SQL RPC `public.get_filtered_submissions` supports:
    - `status` arrays (IN).
    - `created_at`/`completed_at` operator objects.
    - Answer filter objects for `eq/in/includes/all/contains/gte/lte/gt/lt/between`.
  - Table toolbar shows a compact summary of applied non-facet filters.

Note: Client normalizes legacy `{includes:[...]}` to arrays for compatibility.

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

## Forward-compatible multi-tenancy (minimal)

- We added lightweight multi-tenancy containers:
  - `public.organizations(org_id uuid pk, name text, slug?, created_by uuid, created_at, updated_at)` with owner RLS (created_by = auth.uid()).
  - `public.workspaces(workspace_id uuid pk, org_id uuid NOT NULL, name text, created_by uuid, created_at, updated_at)` with owner RLS. Unique: `(org_id, name)`.
  - `forms.workspace_id uuid NOT NULL` with FK to `workspaces` (`ON DELETE CASCADE`) and index `forms_workspace_id_idx`.
- Today: RLS and most code continue to use `forms.user_id` for authorization; new forms are created under a Personal Organization → Personal Workspace automatically.
- Later: introduce membership tables (`organization_members` and optionally `workspace_members`) and expand RLS to membership checks. Better Auth Organizations can map 1→1 to `organizations`.

## Turbo outputs

We added `turbo.json` with `build` outputs for both library (`dist/**`) and Next apps (`.next/**`) to improve cache behavior and silence output warnings.

## Linting adjustments

To unblock CI while type-hardening continues, both app ESLint configs treat unused vars as warnings, with `^_` naming to intentionally ignore args/vars. We will raise strictness once warnings are reduced.
