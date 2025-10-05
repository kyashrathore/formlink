# Submission Intelligence Job — Design v1

Status: In Progress · Version: 1.0 · Date: 2025-09-26 · Owners: Formlink Core

## 0) Summary

We will execute a per‑submission “intelligence job” after each save/completion to turn raw answers into sidecar fields and automated actions without blocking the submit UX.

Loop (current heuristic implementation): Sense → Decide → Act → Surface

- Sense: fetch submission + answers.
- Decide: apply deterministic spam, lead-score, enrichment, and tagging helpers (AI orchestration pending).
- Act: execute lifecycle-allowed actions through the shared Action Runner (idempotent, logged).
- Surface: persist sidecar fields on the submission, expose in responses UI, and log actions.

Runtime: Next.js `after()` scheduled from write routes so the HTTP response returns immediately.

## 1) Goals / Non‑Goals

Goals (P0)

- Background job per submission to compute sidecar fields and run allowed actions.
- Form‑level lifecycle configuration (Option A) stored on the form and edited via the Default View UI.
- Idempotent action execution per (submission, action.slug, normalizedParams).
- Keep “Auto‑run on matching view” available as an optional advanced path; dedupe if it overlaps lifecycle.

Non‑Goals (P0)

- Heavy AI classifiers (use heuristics for spam first).
- Rule‑based DSL/trigger system (deferred). Use AI decisioning within lifecycle guardrails.
- Spam detection tool is gated by `AI_SUBMISSION_INTEL_SPAM_ENABLED` to allow staged rollout.

## 1.1) Config Storage (Option A — canonical)

Persist lifecycle setup on the form record:

`forms.agent_state.lifecycle_v1` (JSON):

- `enabled: boolean`
- `guardrails: { skipTestmode: boolean, maxActionsPerSubmission: number, cooldownSeconds?: number }`
- `sidecarKeys: string[]` (accepted sidecar fields proposed by AI)
- `allowedActions: Array<{ slug: string; provider: "usesend"|"composio"; params: Record<string, unknown> }>`
  - Params support mapping tokens: `{{answer:QID}}`, `{{sidecar:path}}`, `{{submission:created_at}}`, `{{enrichment:company.domain}}`.
- `orchestratorPrompt?: string` (free‑text instructions the AI agent should follow while deciding spam/score/enrich/tags/actions; guardrails added by system).
- `enabledTools?: Array<"spam"|"enrichment"|"lead"|"tags">` (optional analytics that the planner may call; defaults to all when omitted).

Edited exclusively from the Default View UI. No separate Automations section.

## 2) Open Questions

1. Trigger scope: run actions only when a submission resolves to `completed`, or also on `in_progress` when it first matches a view?
   - Default proposal: actions only on completed; still compute sidecar on any write.
2. Sidecar persistence location: store under `form_submissions.metadata.sidecar` (JSONB)?
   - Proposal: yes; easy to query and to surface as virtual columns.

## 3) Phases

- P0
  - `after()` hooks in submit paths.
  - Job runner modules (sense/score/spam/enrich/match/actions/sidecar).
  - Response views: new `auto_run_on_match` boolean.
  - RPC update: filter by `submission_ids`; merge sidecar into returned answers.
  - UI: per‑view automation toggle; sidecar chips in table; action history drawer via existing logs.
- P1
  - AI spam classifier; enrichment packs; optional `view_id` on action logs; cooldowns.
- P2
  - Rules composer (if/and/or, schedules); scheduled actions windows; on‑prem runner.

## 4) Architecture

Hook points (non‑blocking, via `after()`):

- `apps/formfiller/app/api/forms/[formId]/save-answers/route.ts`
  - After a successful save, schedule: `runSubmissionJob({ submissionId, versionId, trigger })`.
  - Actions gate: only when submission resolves to completed.
- `apps/formfiller/app/api/ai/chat-assist/route.ts`
  - After final answer (all questions answered), schedule the same job.

Job runner (implemented): `apps/formcraft/app/lib/intel/submission-job/`

- `runner.ts`: orchestrates the lifecycle (Sense → Decide → Act → Surface).
- `orchestrator.ts`: AI tool-calling coordinator; model must invoke `detectSpam`, `enrichSubmission`, `scoreLead`, `tagSubmission`, and can request actions via `executeAction`.
- Tool helpers (`tool-spam.ts`, `tool-score.ts`, `tool-enrich.ts`, `tool-tags.ts`).
- `sidecar.ts`: aggregates updates into `form_submissions.metadata.sidecar` (with `last_intel_at`).
- `executor.ts`: enforces guardrails, dedupes actions, and delegates to the shared Action Runner with `source="lifecycle"`.

### 4.1) Orchestrator & Tools (current state)

- Dashboard exposes toggles for analytic helpers (spam, enrichment, lead scoring, tagging). The planner receives only the enabled tools; if a creator disables a tool, the model simply won’t see it.
- Each enabled tool loads a dedicated prompt (`packages/prompts/md/intel/tool_*.md`) and issues its own `generateObject` call to produce structured output before updating the sidecar + telemetry.
- Spam tool invocation requires `AI_SUBMISSION_INTEL_SPAM_ENABLED=true|1`; otherwise it is skipped even if toggled in UI.
- `executeAction` remains available in all cases; guardrails (testmode skip, max actions, allowed slugs, cooldowns) are enforced in both the tool wrapper and executor.
- Tagging supports an optional fixed vocabulary via `forms.agent_state.lifecycle_v1.tagVocabulary`; when absent, falls back to `AI_SUBMISSION_TAG_VOCAB` env. Server-side filter enforces vocabulary, dedupes, lowercases, and caps to `AI_SUBMISSION_TAG_MAX` (default 5).
- Planner returns `{}`; all useful work happens via tool invocations. `tool_catalog` in the planner prompt reflects the enabled subset so the model knows what’s available.

Action Runner (refactor):

- Extract execution core from `apps/formcraft/app/api/actions/execute/route.ts` to `apps/formcraft/app/lib/actions/runner.ts`:
  - `executeAction({ userId, formId, submissionIds, action, viewId?, idempotencyKey? })`.
  - Route handler remains a thin wrapper.

Security & tenancy:

- Look up `forms.user_id` (via `form_versions.form_id`) and run actions under the owner’s user context (Composio `tool_connections`).
- Background writes use the service client; job enforces same-tenant by checking ownership chain before acting.

Failure model (fail‑fast):

- Sidecar upsert failure logs and stops; actions not attempted if sidecar stage fails.
- Action execution errors recorded to `response_actions_log` (already implemented).

## 5) Data Model / DB Changes (P0)

1. `response_views` — add column (optional advanced path):
   - `auto_run_on_match boolean NOT NULL DEFAULT false`
   - Purpose: allow view‑scoped auto‑execution for targeted automations. Lifecycle remains form‑level.

2. RPC `public.get_filtered_submissions` — extend:
   - New optional arg `submission_ids uuid[]` to constrain evaluation to specific submissions (optimization and exact match testing).
   - Return `sidecar jsonb` as a separate property in each row (do NOT merge with raw `answers`).
   - Support `last_updated_at` operator object (same shape as `created_at`) to enable “Abandoned > N days” views based on inactivity.

3. `/api/responses` — allow filter key `last_updated_at`; pass through to RPC. Response shape per row:
   - `{ submission_id, ..., answers: {...}, sidecar: {...} }`

4. `response_actions_log`
   - Add `view_id uuid NULL` (optional) to attribute executions to the originating view.
   - Add `source text` ("lifecycle" | "view" | "manual").
   - Add `tools_applied jsonb` (array) to capture which tools the orchestrator used when deciding this action (optional but recommended).

Types: update `packages/db/supabase/schema.sql` + regenerate types via `pnpm db:gen-types` during implementation.

## 6) Sidecar Payload (JSONB)

`form_submissions.metadata.sidecar` (example):

```json
{
  "spam": { "score": 0.08, "flags": [] },
  "lead": { "score": 72, "tier": "B" },
  "tags": ["pricing", "enterprise"],
  "enrichment": { "email_domain": "acme.com" },
  "last_intel_at": "2025-09-26T12:34:56Z"
}
```

Notes:

- Keep keys flat under `sidecar/*` buckets to avoid collisions.
- Idempotent merges: update only changed keys; preserve unknown keys.

## 7) Idempotency

Per action execution: `idempotencyKey = hash(submissionId + action.slug + normalizedParams)`.

- Normalized params = JSON with sorted keys and token values resolved to canonical paths (not rendered text) for stability.
- We already have `response_actions_log(idempotency_key)` unique index (by `form_id, action_name, idempotency_key`).
- Runner checks existing log → skip duplicate execution.
- Add `source: "lifecycle" | "view" | "manual"` in log payload for attribution.

## 8) UX / UI Flow

Default View (single place for setup)

- Section: “Automation (AI)” (implemented)
  - Toggle: “Enable AI automations for new submissions.”
  - Prompt textarea for orchestrator guidance.
  - “Edit actions” dialog: add/remove curated actions, edit JSON params, error highlighting.
  - “Sync from plan” button mirrors current Response View actions into lifecycle config.
  - Sidecar fields preview: show proposed keys; “Accept” and “Re‑propose”.

Other Saved Views

- No new automation UI by default. Optional: keep “Auto‑run on match” toggle for advanced use. If enabled, the same Action Runner handles dedupe against lifecycle.

Responses table (implemented)

- Sidecar column with tinted styling, client-side filtering, “Last Updated” filter for abandoned views.
- Manual bulk actions continue to use the shared Action Runner (source=`manual`).

Manual follow‑ups (P0, no scheduler)

- Provide a Saved View template “Abandoned > 3 days”.
- Filters: `status = in_progress` AND `last_updated_at` older than 72h.
- Operator UI: add “Last updated > N hours/days ago” to the time filter component.
- User selects rows and runs a follow‑up action manually; Action Runner idempotency prevents duplicates.

## 9) API / Library Surfaces

New exports

- `@/app/lib/intel/submission-job/runner` → `runSubmissionJob({ submissionId, versionId, trigger })`.
- `@/app/lib/actions/runner` → `executeAction({ userId, formId, submissionIds, action, viewId?, idempotencyKey? })`.

- save answers (formfiller → formcraft): `apps/formfiller/app/api/forms/[formId]/save-answers/route.ts` posts to `/api/internal/lifecycle` (formcraft) which runs the job.
- chat-assist: same as above when submission completes.
- forms agent state: `GET/PUT /api/forms/[formId]/lifecycle` (owner RLS) manages `forms.agent_state.lifecycle_v1`.
- `/api/internal/lifecycle`: guarded endpoint for cross-app job triggering (env token).

## 10) Pre‑Implementation Notes (per file)

1. apps/formfiller/app/api/forms/[formId]/save-answers/route.ts

- Purpose: schedule background job via `after()`.
- API: unchanged; internal schedule only.
- Edge cases: only schedule actions when status resolves to completed; always compute sidecar.
- Verify: submit; observe sidecar update and logs; no delay in HTTP response.

2. apps/formfiller/app/api/ai/chat-assist/route.ts

- Purpose: schedule job on all‑answered (completion).
- State: AI path can save partials; ensure we schedule only on completion.
- Verify: complete in chat; job runs.

3. apps/formcraft/app/lib/intel/submission-job/\* (new)

- Purpose: implement Sense/Decide/Act/Surface pipeline.
- API: `runSubmissionJob` entrypoint, pure helpers per stage.
- Edge: large payloads; respect `testmode`; timeouts; log durations.
- Verify: direct invocation in dev route; inspect sidecar and logs.

4. apps/formcraft/app/lib/actions/runner.ts (new)

- Purpose: reusable executor for actions with idempotency.
- API: `executeAction(...)` (wraps `/api/actions/execute` logic).
- Verify: unit‑ish calls from job + existing API.

5. apps/formcraft/app/api/actions/execute/route.ts

- Purpose: call the new runner; preserve existing API.
- Verify: manual execute works as before; logs unchanged.

6. packages/db/supabase/schema.sql (update)

- Purpose: add `auto_run_on_match`; extend RPC; optionally add `view_id`.
- Verify: `pnpm db:gen-types`, local RPC works, insights unaffected.

7. apps/formcraft/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/\*

- Purpose: expose automation toggle; reflect readiness.
- Verify: toggle persists to `response_views` and disables until ready.

## 11) Validation Plan

- Typecheck: `pnpm -w type-check` (no emit).
- Lint: `pnpm -w lint`.
- Manual happy path:
  1. Create view with filters + one configured action + enable Auto‑run.
  2. Submit a completed response that matches the filters.
  3. Expect: sidecar fields present; one action log; no duplicate on retry.
- Manual negative:
  - Test submissions: ensure skipped.
  - Missing auth/params: UI prevents enabling; runner logs and skips.

## 12) Risks & Mitigations

- Over‑triggering on partial saves → actions gated to completed.
- Race between save and read → job queries by `submission_id`; safe.
- AI cost creep → keep spam heuristic in P0; AI classifier gated in P1.

## 13) Rollout

- Implement DB + runner + hooks behind the new per‑view toggle.
- Ship UI toggle + logs first; then enable automation per view.
- Monitor action failures via `response_actions_log` and server logs.

## 14) Work Plan by Sub‑Agent

- FE: Automation toggle + readiness UI; sidecar chips; history drawer.
- BE: Runner modules; extract action executor; RPC + column merge.
- PM: Define default sidecar keys per template; doc user‑visible behavior.
- Reviewer: Type/lint gates; ensure no blocking in submit paths.

## 15) TODOs

- TODO(INTEL): Decide completion‑only vs partial trigger for actions.
- TODO(INTEL): Confirm sidecar JSON location and key naming.
- TODO(INTEL): Add `auto_run_on_match` column and wire to views API.
- TODO(INTEL): Extend RPC `get_filtered_submissions` (submission_ids, sidecar merge).
- TODO(INTEL): Add `last_updated_at` support to `/api/responses` and RPC operators; add UI control.
- TODO(INTEL): Extract `calcScore` to shared util consumed by BE.
- TODO(INTEL): Add `executeAction` library and refactor route.
- TODO(INTEL): Add dev route to invoke `runSubmissionJob` manually in dev (Jest coverage exists).
- ✅ (2025-09-27) Replace heuristic orchestrator with AI-driven planner (prompt + schema) and capture tool telemetry.
- ✅ (2025-09-27) Enforce cooldown guardrail per action using `response_actions_log` history.
- TODO(INTEL): Expand logging/metrics (success/failure counts, tool telemetry) and broaden automated tests (assert telemetry + edge cases).

## 16) Implementation Status

- ✅ Lifecycle config API (`/api/forms/:formId/lifecycle`) and Default View UI (toggle, prompt, action editor, sync-from-plan).
- ✅ Shared Action Runner integrated across manual/view/lifecycle paths with idempotency + logging.
- ✅ Sidecar persistence + Responses UI columns; `last_updated_at` filter enabled.
- ✅ AI tool-calling orchestrator populates sidecar and triggers allowed actions; analytics can be toggled per form.
- ✅ Cross-app trigger via `/api/internal/lifecycle` for formfiller → formcraft hand-off.
- ✅ AI model integration, cooldown enforcement, and Jest end-to-end coverage (`app/__tests__/submission-lifecycle-job.e2e.test.ts`).

## 17) Notes on docs

- This document tracks v1 implementation plus remaining work.
- `automation_triggers_v1.md` stays as deferred research for a future rule/DSL system.
