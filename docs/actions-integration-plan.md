# Actions Integration Plan (useSend + Composio)

_Last updated: 2025-09-14_

## Goals

- Keep Response Intelligence email actions on our self-hosted useSend instance (no vendor swap).
- Introduce Composio as the unified source for non-email actions (HubSpot tickets, Linear issues, Slack notifications, etc.).
- Give users a discoverable, authenticated action catalog that we can surface as plan suggestions and execute on selected submissions.

## Scope

- Covers server-side APIs, chat agent orchestration, and dashboard UI updates required to fetch, configure, and execute actions.
- Excludes historical action migration. Existing `response_actions_log` schema remains the audit sink.

## System Overview

```
User ask → RI Plan (with suggested actions) →
  - Email action? → useSend adapter
  - Other action? → Composio toolkit search → user config/auth → execute via Composio → log + sidecar updates
```

## Key Decisions

1. **Email pipeline** stays single-path through `usesend-js` calling our Railway deployment. No Composio wrapper.
2. **Composio footprint**:
   - Fetch tools dynamically with `composio.tools.get` using `search` (semantic) or `toolkits` filters.
   - Auth handled via programmatic `connectedAccounts.link/await` flows.
   - Execution through `composio.tools.execute` or provider tool calling depending on UI context.
3. **User identity**: we reuse the existing Formlink `user_id` (UUID) as `userId` when talking to Composio.
4. **Toolkit visibility** driven by allow-list in app config (prevent exposing unsupported integrations).

## Backend Work

### 1. Composio Client Wrapper

- Create `apps/formcraft/app/lib/actions/composio-client.ts` exporting a singleton `Composio` client (lazy init, caches API key, disables auto file handling initially).
- Provide helper methods:
  - `searchTools({ userId, query, toolkits?, limit? })`
  - `getTools({ userId, toolkits, scopes?, limit? })`
  - `executeTool({ toolSlug, userId, args })`
  - `ensureAuth({ userId, authConfigId, callbackUrl? })`
- Centralize error translation → `ActionExecutionError` with status + message.

### 2. Auth Configuration Service

- Expose `/api/actions/auth-configs` (GET) returning available toolkits, auth config ids, scopes.
- Expose `/api/actions/authorize` (POST) to initiate Composio connect link and return redirect URL + polling token.
- Track connection status via `waitForConnection` in background worker or poll endpoint.
- Persist connected account metadata in Supabase (optional for caching); fall back to live Composio checks if missing.

### 3. Tool Discovery Endpoint

- Add `/api/actions/tools` with inputs `{ formId, search?, toolkits?, limit? }`.
- Guardrails:
  - form ownership + rate limits.
  - restrict `toolkits` to allow-list.
  - map `search` to `composio.tools.get` (search filter) with fallback to curated tool list when empty results.
- Response shape: tool slug, label, description, toolkit, required scopes, auth status for the requesting user.

### 4. Execution Endpoint

- Add `/api/actions/execute` to unify useSend + Composio flows.
- Payload `{ formId, submissionIds, action: { kind: "email" | "composio", slug, params } }`.
- Branching:
  - `kind="email"` → call `useSendAdapter.sendEmail` (existing/expanded) with template/util.
  - `kind="composio"` → invoke `composio.tools.execute(slug, { userId, arguments })`.
- Ensure idempotency with `response_actions_log` (reuse `idempotency_key` pattern from docs).
- Return `{ status, provider_ref?, sidecarUpdates? }`.

### 5. Response Intelligence Integration

- Update `apps/formcraft/app/lib/ri/types.ts` `actions` metadata to include optional `provider` hint (`"usesend" | "composio"`).
- In RI planner prompt, inject known toolkits list so suggestions align with supported actions.
- After plan generation, derive `authStatus` for each suggestion before rendering (call new tools endpoint).

## Frontend Work

### Response Plan Card (Responses Tab)

- Remove the plan preview panel from the chat sidebar; relocate the UI into the Responses tab. On first render it spans full width above charts.
- Card contents:
  - Current plan summary (filters, insights, suggested actions).
  - Each suggested action lists its toolkit and status (`Needs auth`, `Configure params`, `Ready`).
  - Inline `Configure toolkit` button launches the auth flow; once authed, render inline form fields for required static parameters. Saving writes to Supabase and moves the action to `Configured`.
- Card chrome: `Save` button (persists edited defaults) and dismiss `×`. Dismissing hides the card but adds a "Response Plan" button in the toolbar/header to reopen it on demand.
- Users can adjust parameters here any time; changes update the stored config immediately.

### Settings → Actions & Integrations

- Settings tab mirrors the state shown in the plan card and doubles as the long-term management surface.
- Each curated action exposes:
  - Auth state (Connect/Disconnect).
  - Stored static parameters (Slack channel, Google Sheet ID, etc.) with edit controls.
  - Optional defaults (message templates, labels).
- Store values in Supabase (`actions_config` table keyed by user/form/toolSlug`).
- Users can configure actions either from the plan card or this settings page; both surfaces read/write the same records.

### Responses Toolbar

- "Actions" button still opens execution sheet/dialog for ad-hoc runs.
- Use stored config (populated via plan card or settings) to pre-fill static fields; only prompt for dynamic inputs (Slack message text, row values, etc.).
- If an action is unconfigured, display a `Needs setup` badge with CTA "Open Response Plan" to reopen the card for inline configuration.

### Auth Modal

- Flow:
  - Call `/api/actions/authorize` for toolkit → receive redirect URL + connectionRequestId.
  - Open Composio-hosted auth in new tab/window (we pass our callback URL in the request).
  - Composio redirects back to our callback. Handler records the connectionRequestId and marks the auth state as `pending_confirmation` in Supabase.
  - Final confirmation: when the user actually triggers an action (or immediately after the callback), call `connectedAccounts.waitForConnection(connectionRequestId)` server-side to guarantee credentials are ready.
  - Refresh tool auth state in UI.

### Execution UI

- When user clicks `Run`, POST `/api/actions/execute`.
- Show optimistic toast + log entry link (reusing existing action log once wired).
- Sync sidecar updates into table via existing store.

## Data & Logging

- Extend `response_actions_log` to store `provider` enum (`usesend`/`composio`).
- Capture `connected_account_id` for Composio executions.
- Audit params (scrub secrets) and provider response.

### Parameter Mapping Strategy

- Use `composio.tools.get` / `getRawComposioToolBySlug` to obtain the canonical JSON schema for every curated tool (arguments, types, required flags).
- Persist a light-weight descriptor per curated action (label, help text, default bindings). Descriptor can also hide parameters the platform auto-fills (e.g., sheet ID from Settings).
- Frontend form generator reads both structures: schema drives validation + widgets, descriptor tweaks UX.
- Backend validates the submitted params against the schema before calling `tools.execute`; if the user supplied an unexpected field, the request fails locally before hitting Composio.

## AI Prompt Updates

- Teach RI planner about available Composio actions via system prompt snippet listing top slugs.
- Emphasize: "Email actions must use useSend; other actions should specify toolkit slug (e.g., `HUBSPOT_CREATE_TICKET`)."

## Testing Strategy

1. Unit tests for Composio client wrapper (mock fetch).
2. Integration tests hitting staging Composio with test auth (flagged).
3. E2E: simulate plan -> configure -> execute on sample submissions.
4. Regression: verify existing email action flow unaffected.

## Rollout Steps

1. Land backend capabilities behind feature flag `ACTIONS_COMPOSIO_ENABLED`.
2. Release tool discovery UI to internal workspace only.
3. Gradually enable execution per toolkit once auth configs validated.

## Open Questions

- Tool metadata caching: skip dedicated cache; fetch on demand when config/settings screens need it. Defaults/templates already persist required fields per action.
- Multi-account support per toolkit? (Assume 1-by-default, add picker later.)
- Should we store user-provided default params/templates for repeated actions?

## Appendix

- Composio Docs referenced:
  - Fetching & Filtering Tools (semantic search, toolkit filter, scopes).
  - Executing Tools (provider.handleToolCalls, direct execute).
  - Authenticating Tools (link + initiate flows, AuthScheme helpers).
- useSend Docs: `docs/todo.md` for SDK usage + env vars.
