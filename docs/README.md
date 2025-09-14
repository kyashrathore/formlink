# Formlink — Unified Doc

Single, concise source of truth for the product vision, Response Intelligence PRD, requirements, technical design, implementation plan, action adapter, sidecar strategy, use‑case patterns, and a short AI agent guide.

Last updated: Sept 14, 2025

---

**Vision & Current State**

- One surface for capture → triage → insights → action → embed.
- Sidecar‑first model keeps data flat and flexible; actions run via adapter (ACI now; composio‑ready).
- Current UI: fast grid with sorting/selection/paging; Status/Test/Created facets; CSV export with injection mitigations.
- Implemented server features: Views CRUD (config), insights/funnel endpoints, webhook action with audit.
- Deferred UI (exists or planned): view tabs, insights cards, manage columns, large export queue, real‑time.

---

**Response Intelligence (One‑Pager PRD)**

- Goal: Users ask natural‑language questions about responses (e.g., “show top‑tier candidates”) and get insights, a table view with needed columns, and suggested actions. They refine and Save as a reusable view.
- Flow
  - Ask: user prompt in Responses → AI uses form schema + sample rows + saved views.
  - Clarify: brief follow‑ups to define ambiguous terms (e.g., “top‑tier”).
  - Plan: server returns plan `{ rpc_args|sql, columns[], insights[], actions[], followups? }` with `session_id`.
  - Preview: workspace shows insights, table preview, and action suggestions (auth‑aware).
  - Refine: user edits/removes insights, columns, filters, actions.
  - Save: “Save as View” persists as a standard Saved View (+ optional action presets).
- UX: new AI tab beside current Responses view; stacked Insights → Table → Actions; right rail for adjustments; footer Save.
- APIs
  - `POST /api/forms/{formId}/response-intelligence/propose` → plan + `session_id`.
  - `POST /api/forms/{formId}/response-intelligence/preview` → validated rows/insights + action auth status.
  - `POST /api/forms/{formId}/views` (existing) → save refined plan as view.
  - `POST /api/actions/execute` (adapter) → `{ status, provider_ref?, sidecar_updates[] }`.
- Sidecar ↔ Actions: each suggested action proposes tracking fields; on execute, adapter can return `sidecar_updates` like `set|inc|append|remove` to apply atomically with audit + idempotency (e.g., `status='hired'`, `mailed_count+=1`, `hubspot_contact_id`).
- Safety: AI never runs raw SQL; server compiles/validates; RLS/allow‑lists enforced; signed URLs for files; CSV safe.

---

**Requirements (Highlights)**

- V1 scope: Saved Views; Response Intelligence (propose/preview/save); insights lite; actions via adapter; public/embeds for selected views.
- Success: table renders <2s for ~1k rows; filters <500ms; exports safe; actions audited/idempotent; adapter returns writebacks where relevant.
- Non‑goals: heavy analytics/ML dashboards; in‑house mailer; per‑view materialization.

---

**Technical Design**

- Stack: Next.js App Router (React, Tailwind, shadcn style, Zustand, TanStack Query) + Supabase (Postgres + RLS).
- Core RPC: `public.get_filtered_submissions(...)` backs Responses and previews.
- Data shapes
  - Submissions: `submission_id, form_version_id, created_at, completed_at, status, testmode, answers JSON`.
  - Views config: `{ id, name, submission_filters, answer_filters, columns, sort, is_default }`.
  - Sidecar: JSONB annotations joined at read; promote to typed columns only if hot.
- Endpoints
  - `GET /api/forms/{formId}/responses` — list via RPC with paging; authz enforced.
  - `POST /api/forms/{formId}/responses/export` — CSV for filtered/selected; stream; queue later for large.
  - `GET|POST|PUT|DELETE /api/forms/{formId}/views[/{viewId}]` — view configs.
  - `GET /api/forms/{formId}/funnel` — cached light analytics.
  - Response Intelligence propose/preview (above).
  - Public: `GET /api/public/views/{viewId}/data` — API key + per‑field allow‑list.
- Security
  - RLS everywhere; per‑field allow‑list for public and for action parameter egress.
  - Sidecar writebacks limited to allowed keys/types; idempotency + audit; concurrency via revision/transaction checks.
  - CSV injection mitigations; signed short‑lived file URLs.
- Performance
  - Server‑side filtering + pagination; UI virtualization; indexes on submissions and common sidecar paths; cache insight cards.

---

**Action Adapter (ACI ⇄ composio)**

- Interface: `searchFunctions(intent)`, `ensureAuth(apps)`, `execute(action_key, params, owner_id)`.
- Provider: `aci` now (self‑hosted MCP). Switchable to `composio` by flag/env without UI changes.
- Auth: adapter returns connect URLs when missing; UI shows inline “Connect” CTA.
- Output: `{ status, provider_ref?, sidecar_updates[] }` enabling tracked writebacks.

---

**Implementation Plan (Phases)**

1. Views + Actions skeleton (AI‑first)
   - Propose/Preview endpoints; minimal adapter actions (email, Slack, CRM create) with audit + idempotency.
2. Insights lite
   - Count, 7‑day trend, one breakdown; cache per view.
3. Public JSON for Testimonials
   - Approve/publish flow; tokenized endpoint; minimal widget.
4. More actions via adapter
   - Notion create_page, GitHub issue, Stripe payment link; provider flag for composio.

- Migrations (examples): `20250912_get_filtered_submissions_status_array.sql`, `20250912_response_views_and_api_keys.sql`, optional actions idempotency.
- Verification: toolbar facets; grid‑only loading; CSV exports; RLS on views; insights/funnel respond; actions audited; public endpoints require API key + allow‑list.

---

**Sidecar Strategy & Unified Mutation API**

- Store sidecar keys in JSONB (`submission_annotations.data`) with per‑form allow‑list and type validation; add GIN index as needed.
- If keys become performance‑critical, promote to typed columns via migration without changing view configs.
- Future API: `POST /api/forms/{formId}/submissions/{submissionId}/sidecar` (and bulk) with ops `set|inc|append|remove|toggle`; audited + idempotent; RLS + allow‑list enforced.
- Feedback example: `vote_count` increments; at scale, a normalized `submission_votes` table can reconcile into the counter.

---

**Use‑Case Blueprints (Short)**

- ATS Lite: pipeline by `stage`, Shortlisted; actions — move stage, screening email, CRM/Notion.
- Leads (Micro‑CRM): Qualified/High‑value/Follow‑up; actions — create contact/deal, intro email, assign owner.
- Testimonials: Approve/publish; public view → widget; actions — consent email, publish.
- Events: Confirmed/Waitlisted/Checked‑in; actions — QR tickets, waitlist promote.
- Bugs/Features: triage views; actions — GitHub/Linear, Notion page; optional rice_score.
- UGC/Quotes/RMA/Support: see patterns; all actions via adapter; writebacks tracked in sidecar.

---

**AI Agent Guide (Condensed)**

- Where: Responses UI `apps/formcraft/app/dashboard/forms/[formId]/**`; API in `apps/formcraft/app/api`; DB migrations in `packages/db/src/migrations`; shared UI in `packages/ui`; schema in `packages/schema`.
- Do: follow this doc for naming and scope; keep diffs small; RLS/authz first; route all actions via adapter; update docs if endpoints change.
- Safety checklist: parameterized SQL; RLS on RPC; CSV export protections; API keys hashed; per‑field allow‑lists for egress.

---

**Changelog**

- 2025‑09‑14: Consolidated all docs into this single file; introduced Response Intelligence details and adapter model.
- 2025‑09‑13: Grid/exports/facets improvements; action audit log; docs folder restructured earlier.
