# Formlink — Response Intelligence (Stateless Agent) Plan

Last updated: 2025-09-14

Goal: Add “Response Intelligence” by reusing the existing form endpoint and plugging in a stateless agent. The agent returns a renderable plan; the frontend uses that plan to call the existing responses API/RPC. No sessions, no new tables, no extra endpoints. No server‑side insights cache.

Architecture

- No new routes. RI is implemented as a chat tool inside `createChatTools` and is invoked via chat metadata (request.options) indicating `intent: "response_intelligence"` (no visible markers in the user's message). The tool returns a strict JSON plan; the UI then maps it to the existing `/api/responses` call.
- Invocation signal: set `options.intent = "response_intelligence"` on the chat POST body. No tags or keywords are required in the user-visible message.
- Agent: Implemented as a chat tool `responseIntelligence` that returns only a strict JSON plan. It may receive full chat history; we do not trim by default.
- Frontend: uses the returned plan to call the existing responses API (which calls `get_filtered_submissions`) and renders the table/insights. Insight metrics are returned by the responses API; the UI only renders cards. No separate insights cache.

Data Boundary (hard checks live here)

- The existing responses endpoint remains the enforcement point. It must:
  - Validate ownership/auth (form/form_version belongs to requester; RLS enforced).
  - Allow‑list submission filter keys: `form_version_id, status, testmode, created_at { gte|lte }, user_id`.
  - Validate `answer_filters` against the form version’s question IDs and types.
  - Clamp page size, date window, count of filters/columns; restrict `sort.by` to allowed fields; set safe defaults (`status='completed'`, `testmode=false`).
  - Reject or trim invalid/overbroad inputs and return results safely.

API Contract (RI)

- Request (RI):
  - Chat POST body includes `options.intent = "response_intelligence"`. The tool input is `{ prompt: string }` based on the latest user message content.
- Response (RI):
  - `{ plan_version: "ri.v1", plan: { rpc: { submission_filters: object; answer_filters: object; page_size?: number }, ui: { columns: string[]; sort?: { by: string; dir: "asc"|"desc" }; insights_spec?: Array<{ type: "count"|"trend"|"breakdown"; args: object }> }, actions?: Array<{ action_key: string; params: object; title?: string }>, sidecar_spec?: { proposed_keys?: Array<{ key: string; type: "string"|"number"|"boolean"|"timestamp"|"json"; description?: string; default?: any; pii?: "none"|"low"|"high"; index_hint?: "none"|"gin"|"btree" }>, virtual_columns?: Array<{ key: string; label?: string; format?: string }> }, meta?: { rationale?: string; followups?: string[]; view_name?: string } }, warnings?: string[], correlationId?: string }`
- Existing create‑form stays as:
  - `{ kind: "create_form", userPrompt: string, ... }`

Example

Request

`POST /api/chat` with `options.intent = "response_intelligence"` and messages containing the natural instruction (e.g., "show high‑value leads last 7 days").

Response

`{ "plan_version":"ri.v1", "plan": { "rpc": { "submission_filters": {"form_version_id":"v-789","status":"completed","created_at": {"gte": "now()-7d"}, "testmode": false }, "answer_filters": {"q_score": {"gte": 8}}, "page_size": 50 }, "ui": { "columns": ["created_at","status","q_name","q_email","q_score"], "sort": {"by":"created_at","dir":"desc"}, "insights_spec": [{"type":"count","args":{"label":"Completed"}},{"type":"trend","args":{"window":"7d"}}] }, "actions": [{"action_key":"GMAIL_SEND_EMAIL","title":"Email shortlisted leads","params":{"template":"intro"}}], "sidecar_spec": { "virtual_columns": [{"key":"sidecar.lead_score","label":"Lead Score"}] }, "meta": { "rationale": "‘high‑value’ mapped to score>=8" } }, "warnings": [], "correlationId":"..." }`

Client mapping to responses API

- From the RI response, call your existing responses list with roughly:
  - `search = { ...plan.rpc.submission_filters, ...plan.rpc.answer_filters }`
  - `page_size = clamp(plan.rpc.page_size)`
  - `sort = plan.ui.sort`
- The responses API applies its hard validation/normalization before executing the RPC.
- Use aggregate metrics returned by the responses API (e.g., `totalFilteredCount`, `totalCompletedCount`, `totalInProgressCount`) to populate the insight cards.

UI Plan

- Layout
  - Left sidebar: reuse the existing ChatPanel used for form creation. Keep complete conversation history. The assistant detects an RI tag in the user's message and invokes the RI tool; no separate chat surface.
  - Right panel (Responses): top row shows view tabs, then an insights row, then the responses table with its filter/action bar.
- View tabs (right panel)
  - Show saved views as tabs (e.g., “Default”, “Top Applicants”).
  - When a new RI plan is proposed and not yet saved, open an ephemeral tab using `plan.meta.view_name` for its label and show a Save icon and a Close (X). Switching between tabs swaps filters/columns/sort per the view config.
- Insights row (server‑provided values)
  - Three insight cards across the top. Values (e.g., totals) are returned by the responses API for the active view; the browser simply renders them. No separate insights cache.
  - Driven by the active view (saved or in‑progress). `plan.ui.insights_spec` controls which cards to render.
- Responses table + controls
  - The toolbar row above the table retains search and facets (Status/Test/Created) and the kebab menu.
  - Columns come from `plan.ui.columns`: core fields, question IDs, and virtual sidecar columns when present. Sorting maps to `plan.ui.sort` if allowed; pagination via existing responses API.
  - For the “Untitled (in progress)” tab only: surface suggested actions up front (visible buttons in the toolbar’s `rightActions` area) rather than hiding behind the kebab menu. In saved tabs, actions can remain under the kebab unless promoted.
- Column highlighting
  - Sidecar virtual columns: highlight as new (e.g., header pill “New”, subtle tinted header/background). These are backed by `sidecar.*` keys; display read‑only values.
  - Derived/joined columns: highlight distinctly (e.g., header pill “Derived” or “Joined”) for any columns computed from combinations or joins. Show an info tooltip with the derivation where possible.
- Save as View flow
  - Clicking “Save as View” persists the plan‑derived config (see section below) and converts “Untitled (in progress)” into a named, saved tab.
  - Immediately after saving, show a callout instructing the user to set up Action authorization (Composio) if any actions are present.
- Actions state and authorization
  - Before authorization: show actions as disabled with an “Auth not set up” label/badge and a prominent “Connect”/“Authorize” affordance. Keep them visible up front in the “Untitled (in progress)” tab.
  - Authorization flow: clicking an action triggers `POST /api/actions/authorize` to obtain a provider connect link; after completion, actions become active.
  - After authorization: switch actions to active styling (enabled buttons), and allow execution via `POST /api/actions/execute` with idempotency + audit.
- States
  - Idle (no plan), Loading (plan/data), Ready (rows + insights + suggestions), Error (validation/fetch with safe fallbacks), Unsaved (special UI for the “Untitled (in progress)” tab as above).

Stored Views (what gets stored)

- When the user clicks “Save as View,” persist the following derived from the RI plan:
  - Filters: `plan.rpc.submission_filters` and `plan.rpc.answer_filters`.
  - Presentation: `plan.ui.columns` and optional `plan.ui.sort`.
  - Optional: `plan.ui.insights_spec` to configure which insight cards to show. The values come from the responses API; the UI only renders them.
- Do not persist the full chat history. You may store `plan_version` for forward compatibility; `correlationId` is request‑scoped only.
- No separate API exists for sidecar creation/schema; any sidecar proposals are suggestions only.

Actions & Execution Adapter

- Plan suggestions
  - `plan.actions?: Array<{ action_key: string; params: object; title?: string }>`; suggestions only, never auto‑run.
  - Keys must be allow‑listed server‑side; params validated per tool schema.
- Server endpoints
  - `POST /api/actions/authorize` → returns `redirectUrl` for connecting toolkits; supports callback.
  - `POST /api/actions/execute` → `{ action_key, params, user_id, idempotency_key, correlationId }`.
    - Enforce RLS, field‑level egress allow‑lists, idempotency, and audit (who/what/when/inputs/outputs/sidecar diff).
    - Apply any `sidecar_updates` atomically with the audit record.
- UI behavior
  - Show suggestions with titles; on click, run `authorize` (e.g., Composio connect) when needed, else `execute`.
  - Display result and applied sidecar changes; refresh the grid when relevant.

Submission Sidecar (read model and writebacks)

- Model
  - Store annotations under JSONB (e.g., `submission_annotations.data`) with a per‑form allow‑list and type validation.
  - Virtual columns are UI representations of allowed sidecar keys and are referenced as `sidecar.<key>` in `plan.ui.columns`.
- Proposals in plan
  - The RI plan may include `sidecar_spec.proposed_keys[]` (suggested new keys) and `sidecar_spec.virtual_columns[]` (columns to display).
  - Proposals do not create schema; they require admin approval and allow‑list updates via internal tooling.
- No separate sidecar creation API
  - There is no dedicated public endpoint for sidecar schema/creation. Any writebacks happen via the Action Adapter.
- Writebacks
  - When actions execute, they may include `sidecar_updates` that set/patch allowed keys with audit + idempotency.
  - Conflicts resolved via revision/transaction checks; logs redact PII.
- Naming & types
  - snake*case keys; avoid collisions with core fields; reserve prefixes like `sys*_`and`ri\__`.
  - Types: `string|number|boolean|timestamp|json`; defaults optional; PII classification required for new keys.

Minimal Phases (All RI‑focused)

1. Route Union + Types

- [x] Route branching not required. RI is wired into `/api/chat` via `options.intent` (no changes to forms route).
- [x] Add `apps/formcraft/app/lib/ri/types.ts` (Zod) for RI request/plan (strict plan + insights schemas).
- Test: set `options.intent = "response_intelligence"` and verify a validated plan is returned in the tool result/stream event.

2. RI Agent

- [x] Implement chat tool `apps/formcraft/app/lib/chat/tools/response-intelligence.ts` (model-first with heuristic fallback).
- [x] Context: prompt + full chat history (+ form schema, questionIds). No sessions.
- Test: no API key → heuristic plan; with key → richer plan; output passes Zod.

3. Responses UI Wiring

- [x] When an RI plan is returned (tool result), map plan → call existing responses API; render table using plan.ui.
- [x] Insights computed server-side via `/api/responses?insights=...` (client fallback retained for trend/breakdown).
- Test: prompts alter columns/filters; grid latency acceptable (<2s dev).

4. Guardrails

- [x] Strict Zod for plan types in RI (includes `plan_version` and `correlationId`).
- [x] Hard checks in `/api/responses` (ownership, allow‑lists, clamps, safe defaults) extended to support insights.
- [ ] Optional: normalize & preflight the plan server‑side and attach `warnings[]` if simplified.
- Test: fuzz invalid RI inputs → 400; responses API still clamps/validates independently; RLS intact.

5. Insights + Charts

- [x] `/api/responses` supports `insights` (count, trend, breakdown; multi‑series via `args.by`; `window` honored).
- [x] Charts render in Responses via `ResponseCharts` using `@formlink/ui/ui/chart` (Line/Bar, stacked breakdowns).

6. Plan Preview UX

- [x] Chat shows a contextual RI plan preview (filters, columns, sort, insights, actions) with Save/Open/Copy.

Optional later: action suggestions/execution adapter.

Pointers in Repo

- Chat route: `apps/formcraft/app/api/chat/route.ts` (unchanged logic; tools handle RI)
- Tool: `apps/formcraft/app/lib/chat/tools/response-intelligence.ts`
- Types: `apps/formcraft/app/lib/ri/types.ts`
- RPC: `apps/formcraft/supabase/schema.sql` → `get_filtered_submissions`
- Responses UI: `apps/formcraft/app/dashboard/forms/[formId]/components/data-table/**`

Appendix — Useful commands

- Install: `pnpm install`
- Build all: `pnpm build`
- Type-check all: `pnpm type-check`
- Lint all: `pnpm lint`
- Tests (UI): `pnpm --filter @formlink/ui test:ci`
- Dev (builder): `pnpm --filter formcraft dev`
- Dev (renderer): `pnpm --filter @formlink/formfiller dev`
- Storybook: `pnpm storybook`
