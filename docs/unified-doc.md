# Formlink — Unified Doc

Single, concise source of truth for the product vision, Response Intelligence PRD, requirements, technical design, implementation plan, action adapter, sidecar strategy, use‑case patterns, and a short AI agent guide.

Status note: This was the initial end‑to‑end doc. The canonical, focused plan for the stateless Response Intelligence agent now lives at `docs/response-intelligence-plan.md`. This file is aligned with that plan as of 2025‑09‑14. If there is any conflict, defer to `docs/response-intelligence-plan.md`.

Last updated: Sept 14, 2025

---

**Vision & Current State**

- One surface for capture → triage → insights → action → embed.
- Sidecar‑first model keeps data flat and flexible; actions run via Composio adapter by default (pluggable provider boundary).
- Current UI: fast grid with sorting/selection/paging; Status/Test/Created facets; insights lite.
- Implemented server features: Views CRUD (config), responses list, webhook action with audit.

---

**Response Intelligence (One‑Pager PRD)**

- Goal: Users ask natural‑language questions about responses (e.g., “show top‑tier candidates”) and get insights, a table view with needed columns, and suggested actions. They refine and optionally Save as a reusable view.
- Flow (Stateless Agent)
  - Ask: user prompt in Responses, with `viewContext: "responsetab"`.
  - Plan: server reuses the existing forms endpoint and returns a JSON plan (no sessions, no separate endpoints).
  - Preview: frontend applies the plan to the existing RPC (`public.get_filtered_submissions`) to fetch rows; insights are computed client‑side.
  - Refine: user edits filters/columns locally or resubmits prompt.
  - Save (optional): persist as a view using the standard Views mechanism (separate from RI).
- UX: AI panel alongside the Responses grid; stacked Insights → Table → Actions suggestions; right rail for adjustments.
- API (union at handler, per‑kind strict schemas)
  - `POST /api/forms/{formId}` with `body.kind`:
    - Create Form (existing): `{ kind: "create_form", userPrompt: string, ... }`
    - Response Intelligence (request): `{ kind: "response_intelligence", viewContext: "responsetab", prompt: string, formVersionId: string, uiHints?: { visibleColumns?: string[]; selectedRows?: string[] } }`
  - Response (RI): `{ plan_version: "ri.v1", plan: { rpc: { submission_filters: object; answer_filters: object; page_size?: number }, ui: { columns: string[]; sort?: { by: string; dir: "asc"|"desc" }; insights_spec?: Array<{ type: "count"|"trend"|"breakdown"; args: object }> }, actions?: Array<{ action_key: string; params: object; title?: string }>, sidecar_spec?: { proposed_keys?: Array<{ key: string; type: "string"|"number"|"boolean"|"timestamp"|"json"; description?: string; default?: any; pii?: "none"|"low"|"high"; index_hint?: "none"|"gin"|"btree" }>, virtual_columns?: Array<{ key: string; label?: string; format?: string }> }, meta?: { rationale?: string; followups?: string[] } }, warnings?: string[], correlationId: string }`
  - Security: no raw SQL; only RPC arguments; Zod validation at boundaries.
  - Follow‑ups: optional short clarifications can be done via another RI call; still stateless; track via `correlationId`.
- Sidecar ↔ Actions: suggestions only; execution (and writebacks) via optional adapter later.

---

**Requirements (Highlights)**

- V1 scope: Saved Views; Response Intelligence (propose/preview/save); insights lite; actions via adapter.
- Success: table renders <2s for ~1k rows; filters <500ms; actions audited/idempotent; adapter returns writebacks where relevant.
- Non‑goals: heavy analytics/ML dashboards; in‑house mailer; per‑view materialization.

---

**Technical Design**

- Stack: Next.js App Router (React, Tailwind, shadcn style, Zustand, TanStack Query) + Supabase (Postgres + RLS).
- Core RPC: `public.get_filtered_submissions(...)` backs Responses and previews.
- Data shapes
  - Submissions: `submission_id, form_version_id, created_at, completed_at, status, testmode, answers JSON`.
  - Views config: `{ id, name, submission_filters, answer_filters, columns, sort, is_default }`.
  - Sidecar: JSONB annotations joined at read; promote to typed columns only if hot.
  - Sidecar virtual columns: UI-visible columns mapped to `sidecar.<key>` with labels/formatting; backed by JSONB keys; optional promotion to typed columns when needed.
- Endpoints
  - `POST /api/forms/{formId}` — union route; branch on `kind` for `create_form` and `response_intelligence`.
  - `GET /api/responses` — list via RPC with paging; accepts `search`, `page`, `pageSize`; authz enforced.
  - `GET|POST|PUT|DELETE /api/forms/{formId}/views[/{viewId}]` — stored view configs (save RI plans as views).
  - `POST /api/actions/authorize`, `POST /api/actions/execute` — action adapter with allow‑lists, idempotency, and audit.
  - Sidecar
    - No dedicated sidecar creation/schema API. Writebacks, if any, flow through the action adapter; allow‑list and schema adjustments are handled via admin tooling, not a public endpoint.
- Security
  - RLS everywhere; per‑field allow‑list for public and for action parameter egress.
  - Sidecar writebacks limited to allowed keys/types; idempotency + audit; concurrency via revision/transaction checks.
  - Rate limits for RI and action endpoints; redact PII in logs; include `correlationId` for RI in application logs.
- Performance
  - Server‑side filtering + pagination; UI virtualization; indexes on submissions and common sidecar paths.

---

**Filter Grammar (Authoritative)**

- Submission filters (allow‑list): `form_version_id (uuid)`, `status (string | string[])`, `user_id (uuid)`, `created_at.gte/lte (timestamptz)`, `testmode (boolean)`.
- Answer filters: keys must match valid question IDs for the form version. Supported values: exact match against scalar or array of scalars; null matches `NULL`.
- Defaults and clamps: if unspecified → `status='completed'`, `testmode=false`; clamp page size; clamp date window; reject over‑broad requests with 400/422 or return `warnings[]` when normalized.
- Status arrays: supported end‑to‑end; routes must pass arrays through to the RPC.

- Sidecar filters (future)
  - Once allowed, sidecar keys may be filterable via `sidecar_filters` in the RPC input; operators mirror answer filters (exact match, array IN, null).
  - Until then, client can render virtual columns but filtering will be limited to core submission/answer filters.

---

**Action Suggestions & Execution Adapter**

- Purpose: present actionable next steps (e.g., email, CRM create, ticket create) derived from the prompt and current filtered dataset; execute safely via an adapter with strict validation and audit.
- Suggestions in RI plan
  - Optional `plan.actions?: Array<{ action_key: string; params: object; title?: string }>`.
  - Keys are allow‑listed (e.g., `GMAIL_SEND_EMAIL`, `GITHUB_CREATE_ISSUE`, `HUBSPOT_CREATE_CONTACT`).
  - Params are suggestion payloads only; execution requires explicit user action.
- Execution API (server)
  - `POST /api/actions/authorize` → returns `{ redirectUrl }` to connect required toolkits; supports callback.
  - `POST /api/actions/execute` → `{ action_key, params, user_id, idempotency_key, correlationId }`.
    - Server validates `action_key` against allow‑list; validates `params` by tool schema; enforces RLS and field egress allow‑lists.
    - Calls provider (e.g., Composio) to perform tool calls; applies `sidecar_updates` atomically with audit.
    - Returns execution result and applied sidecar diff.
- Security and audit
  - Idempotency required; audit includes who/what/when/inputs/outputs/sidecar diff.
  - No direct external calls from UI; all egress via adapter.
  - Rate‑limit execution per user/form; redact secrets/PII; store minimal logs with `correlationId`.

---

**Stored Views**

- Purpose: persist reusable table configurations (filters/columns/sort) and optionally expose them publicly.
- Schema (conceptual)
  - `views`: `{ id, form_id, name, submission_filters jsonb, answer_filters jsonb, columns jsonb, sort jsonb, is_default bool, is_public bool, field_allowlist jsonb, created_by, created_at }`.
  - RLS: workspace/user‑scoped; public reads only when `is_public=true` with field allow‑list applied.
- Endpoints
  - `GET|POST|PUT|DELETE /api/forms/{formId}/views[/{viewId}]` — CRUD with Zod validation and ownership checks.
  - `GET /api/public/views/{viewId}/data` — API key required; only whitelisted fields; cache headers.
- Behavior
  - The Responses grid loads the default view for a form; saving a view stores the current plan‑derived config.
  - Public embeds use the view’s allow‑list; no writebacks; rate‑limited.
  - Columns must reference valid core fields or question IDs; sort fields must be allowed indices.

**Composio Integration**

- Why: authenticated tool‑calling across Gmail/Slack/GitHub/HubSpot/Notion/etc., with SDKs for TS/Python and provider shims.
- Env: set `COMPOSIO_API_KEY` in server/runtime.
- Install (TypeScript): `pnpm add @composio/core @composio/vercel` (or `@composio/anthropic`, etc.).
- Minimal flow
  - Authorize: backend issues a Composio connect link for a toolkit; UI opens it and waits.
  - Fetch tools: request only the few tools your plan needs (limit 3–5).
  - Invoke LLM: pass `tools` into your provider call; Composio formats them for the provider.
  - Execute: feed the LLM response back to Composio to run tool calls; receive results and optional `sidecar_updates`.
- Example (TypeScript with Vercel AI SDK)
  - Init:
    `const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY, provider: new VercelProvider() });`
  - Authorize a user for Gmail:
    `const req = await composio.toolkits.authorize(userId, 'gmail'); /* open req.redirectUrl */ await req.waitForConnection();`
  - Get tools (narrow set):
    `const tools = await composio.tools.get(userId, { tools: ['GMAIL_SEND_EMAIL'] });`
  - Call LLM and execute:
    `const msg = await generateText({ model: anthropic('claude-sonnet'), tools, prompt });`
    `const result = await composio.provider.handleToolCalls(userId, msg);`
- Our Action API surface (server)
  - `POST /api/actions/authorize` → returns `redirectUrl` via Composio; supports callback.
  - `POST /api/actions/execute` → `{ action_key, params, user_id, idempotency_key }` → Composio → apply `sidecar_updates` atomically with audit.
  - If auth missing, respond with required toolkits so UI can trigger authorization.

---

**Implementation Plan (Phases)**

1. RI Agent (stateless)
   - Add `kind:"response_intelligence"` to forms POST; return validated plan JSON with `plan_version` and `correlationId`; no sessions.
2. Insights lite (client)
   - Count, 7‑day trend, one breakdown; computed on fetched rows.
3. Optional actions suggestions
   - Render suggestions; execute later via adapter.

- Migrations: none required for stateless RI.
- Verification: grid loads; CSV exports safe; RI returns plan quickly (<2s dev); RLS enforced; no raw SQL.

4. Stored Views
   - CRUD endpoints with Zod validation; default view per form; optional `is_public` with field allow‑list.
   - Grid can load/save views; public embed fetches via public endpoint.

5. Action Adapter
   - Implement `authorize` + `execute` endpoints with allow‑lists, validation, idempotency, and audit; integrate Composio.
   - UI executes selected suggestion via adapter; reflect sidecar writebacks in grid.

6. Sidecar Virtual Columns & Allow‑List
   - No separate schema API for creating sidecar keys. Admin approval and allow‑list updates occur via internal tooling; RI may propose keys, but nothing is created implicitly.
   - Update grid to display virtual columns from `plan.sidecar_spec.virtual_columns`; hide until keys exist or mark as pending.
   - Add optional promotion path for hot keys; keep view configs stable via column indirection.

---

**Sidecar Strategy**

- Store sidecar keys in JSONB (`submission_annotations.data`) with per‑form allow‑list and type validation; add GIN index as needed.
- If keys become performance‑critical, promote to typed columns via migration without changing view configs.
- No dedicated public API for sidecar creation. Any writebacks happen via the action adapter with audit + idempotency.
- Feedback example: `vote_count` increments; at scale, a normalized `submission_votes` table can reconcile into the counter.

---

**Sidecar Virtual Columns**

- Concept
  - “Virtual columns” are UI columns backed by sidecar JSONB keys under `submission_annotations.data`.
  - They appear in the grid and exports like regular columns, but are stored as JSONB and can be promoted to typed columns later.
- AI‑driven proposals
  - The RI plan may include `sidecar_spec.proposed_keys[]` for new tracking fields inferred from the user’s ask and suggested actions (e.g., `stage`, `owner_id`, `lead_score`, `last_contacted_at`, `published`, `crm_contact_id`).
  - The plan may also include `sidecar_spec.virtual_columns[]` that the UI should display; labels/formatters are hints and can be overridden.
  - No implicit creation: proposed keys require admin approval and allow‑list update before use.
- Provisioning flow
  - Admin reviews proposed keys, types, defaults, PII flags, and index hints; on approve, keys are added to the per‑form allow‑list.
  - Optional background migration promotes hot keys to typed columns; view configs remain stable.
- Naming & types
  - snake*case; avoid collisions with core fields; reserve prefixes `sys*`and`ri\_`.
  - Types: `string|number|boolean|timestamp|json`; defaults optional; PII classification required.
- Filters & sorting
  - Virtual columns can be filtered/sorted once allowed; for performance, prefer typed promotion or targeted indexes for hot keys.
  - Future: add `sidecar_filters` to RPC contract for server‑side filtering on allowed keys.

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
- Do: follow this doc for naming and scope; keep diffs small; RLS/authz first; route all actions via adapter; propose sidecar keys/virtual columns when helpful but never create implicitly; update docs if endpoints change.
- Safety checklist: parameterized SQL; RLS on RPC; CSV export protections; API keys hashed; per‑field allow‑lists for egress.

---

**Changelog**

- 2025‑09‑14: Aligned this doc with the RI plan in `docs/response-intelligence-plan.md`; clarified stored views (persist the plan), removed server‑side insights cache, and removed any separate sidecar creation/schema API.
- 2025‑09‑14: Response Intelligence updated to stateless agent using existing forms endpoint (planned); removed propose/preview endpoints and sessions.
- 2025‑09‑14: Consolidated all docs into this single file; introduced action adapter and sidecar model.
- 2025‑09‑13: Grid/exports/facets improvements; action audit log; docs folder restructured earlier.
