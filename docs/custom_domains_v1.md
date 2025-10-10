# Custom Domains for Hosted Forms (v1)

Last updated: 2025-10-09

## Overview

Enable creators to serve a specific form at their own domain (e.g., forms.brand.com) on the public responder app (`apps/formfiller`). The flow verifies ownership via DNS, attaches the domain to the runtime, and routes requests by Host header to the target form.

## Scope & Assumptions

- Hosting: `apps/formfiller` deployed on Vercel.
- Mapping: one custom domain maps to one form (1:1). Multiple domains per form are allowed; each domain maps to exactly that form.
- Verification: DNS TXT record (`_formlink-verify.<hostname>`).
- Activation: project-level domain attachment (Vercel API). SSL is auto-provisioned by provider once DNS points correctly.
- Failure mode: fail loudly with actionable errors (no silent degrade or alternate fetch paths).

## Data Model

Table: `public.form_domains`

- `id uuid PK default gen_random_uuid()`
- `form_id uuid not null` → FK `forms.id` (ON DELETE CASCADE)
- `hostname text not null unique` (stored lowercased, punycode normalized; no wildcards)
- `status text not null check in ('pending','verified','active')` — default `pending`
- `verification_token text not null`
- `verified_at timestamptz null`
- `activated_at timestamptz null`
- `notes text null` (provider payloads, debug)
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes & constraints

- Unique index on `lower(hostname)`.
- Btree index on `form_id`.

RLS (outline)

- Select/insert/update/delete allowed for owners of the parent form (same policy as form edit rights).
- No public read.

Migration

- Location: `packages/db/supabase/migrations/2025-XX-XX_form_domains.sql`.
- After migration, regenerate types if applicable.

## User Flow (Creator)

1. Add Domain

- Enter hostname (e.g., `forms.brand.com`) in the builder UI under Share → Custom Domain.
- We create a row with `status=pending` and show DNS TXT instructions.

2. Verify Domain Ownership

- Add TXT record at `_formlink-verify.forms.brand.com` with the provided verification token.
- Click "Verify". The server checks DNS TXT for a token match.
- On success: `status=verified`, `verified_at=now()`.

3. Point Domain and Activate

- Point the domain to the runtime:
  - Subdomain (recommended): CNAME `forms.brand.com → provider target` (e.g., Vercel-managed target).
  - Apex (optional): use A/ALIAS/ANAME if supported (documented carefully; can be deferred).
- Click "Activate". The server attaches the domain to the `formfiller` project via provider API.
- Once provider reports ready and/or first health check passes, `status=active`, `activated_at=now()`.

4. Routing

- Visitors to `https://forms.brand.com` are routed to the specific form on `apps/formfiller` based on Host header.

## Builder UI (apps/formcraft)

Location: Share tab for a form.

- Section: "Custom Domain"
- Features:
  - Add domain: input hostname → POST create
  - Show DNS instructions:
    - TXT: `_formlink-verify.<hostname> = <token>`
    - Verification button (with polling feedback)
  - Activation:
    - Display provider DNS target guidance
    - "Activate" button → provider attach
  - List existing domains with statuses (pending/verified/active), copy link, delete domain
- Gating: feature flag `CUSTOM_DOMAINS` in `apps/formcraft/app/lib/subscription/feature-gate.ts`. Enforce plan limits server-side.

UX Messages (examples)

- Pending: "Add the TXT record shown below, then click Verify."
- Verified: "Point your domain via CNAME, then click Activate to finish."
- Active: "Domain is live. SSL is managed automatically."

## Admin APIs (apps/formcraft)

All routes are server-side Next.js Route Handlers with auth checks and form ownership validation.

1. Create/List Domains

- Path: `app/api/forms/[formId]/domains/route.ts`
- GET → 200 `[ { id, hostname, status, verified_at, activated_at } ]`
- POST body `{ hostname: string }` → 201 `{ id, hostname, status:'pending', verification_token }`
  - Validations: FQDN, no wildcard, lowercase/punycode, uniqueness, plan limit

2. Verify Ownership

- Path: `app/api/forms/[formId]/domains/[domainId]/verify/route.ts`
- POST (no body) → 200 `{ status:'verified' }`
  - Behavior: resolve TXT for `_formlink-verify.<hostname>`; match token
  - Errors: not found, mismatched token, propagation lag → 409/400 with hints

3. Activate Domain (Provider Attach)

- Path: `app/api/forms/[formId]/domains/[domainId]/activate/route.ts`
- POST → 200 `{ status:'active' }` (or 202 if waiting for readiness)
  - Behavior: call provider (Vercel) to attach domain to `formfiller` project; store provider response in `notes`
  - Errors: DNS not pointing yet, provider conflict/limits → return 409/400 with guidance

4. Delete Domain

- Path: `app/api/forms/[formId]/domains/[domainId]/route.ts`
- DELETE → 204
  - Behavior: optionally detach from provider first; then delete row

Configuration (env)

- `VERCEL_TOKEN` (server)
- `VERCEL_TEAM_ID` (optional)
- `VERCEL_FORMFILLER_PROJECT_ID` (target project for domain attach)
- If any missing: return 500 with explicit message (no fallbacks).

## Runtime Routing (apps/formfiller)

Resolver API

- Path: `app/api/domain/resolve/route.ts`
- GET `?host=<hostname>` → 200 `{ formId }` if domain is `active`; else 404
- Cache headers: `Cache-Control: s-maxage=60, stale-while-revalidate=3600`

Middleware

- Path: `apps/formfiller/middleware.ts`
- On request:
  - Read `Host` header
  - Ignore internal/local hosts (`forms.formlink.ai`, `localhost:3001`, etc.)
  - `fetch('/api/domain/resolve?host=...')`; if 200, rewrite to `/${formId}` (preserve query)
  - Otherwise, continue normal routing
- Keep implementation minimal; no Node-only APIs; avoid large dependencies.

## Provider Integration (Vercel)

- Attach domain to project:
  - REST: `POST /v10/projects/{projectId}/domains` with `{ name: <hostname> }`
  - Handle already-exists/conflict as a clear error; do not assume ownership
- DNS guidance
  - Subdomain: prefer CNAME to provider target
  - Apex: support only if we document exact records; defer if unclear
- SSL: automatic after correct DNS; surface readiness in UI once provider reports `READY` or initial request succeeds

## Security & Limits

- Hostname uniqueness enforced in DB; error on duplicate claims
- Ownership verification via TXT required before activation
- No wildcard domains; no per-request fallbacks
- Feature-gate + per-plan limits (e.g., max domains per form/workspace)

## Troubleshooting

- TXT not detected
  - Ensure record name is `_formlink-verify.<hostname>` and contains the exact token
  - DNS TTL/propagation may take time; use `dig TXT _formlink-verify.<hostname>`
- Activation fails
  - Confirm CNAME/A is pointed to the provider target
  - Check provider error message (stored in `notes`); retry after DNS propagates
- SSL not ready
  - Wait for provider readiness; confirm via HTTPS request; re-check after propagation

## Testing & Validation

- Local/stage flow with a test subdomain under a controlled zone
- Regression: normal `/:formId` and embed flows must remain unaffected
- Quality gates (do not restart dev server):
  - `pnpm typecheck`
  - `pnpm -w lint`

## Limitations & Next Steps

- Apex domain support can be restricted initially; document exact records before enabling broadly
- Consider workspace-level domains mapping to multiple forms by slug in a future version
- Add background poller to transition `verified → active` after provider readiness (optional)

## TODOs

- TODO(db): Add `packages/db/supabase/migrations/2025-XX-XX_form_domains.sql` with table, constraints, RLS.
- TODO(be): Implement domain CRUD/verify/activate APIs in formcraft with provider integration.
- TODO(rt): Add resolver API and middleware in formfiller; set cache headers.
- TODO(fe): Implement Share → Custom Domain UI using `@formlink/ui` components.
- TODO(docs): Link this doc from the Share UI help; keep examples updated.
- TODO(ops): Set `VERCEL_TOKEN`, `VERCEL_FORMFILLER_PROJECT_ID`; create a runbook for token rotation.
- TODO(qe): Stage end-to-end test on a real subdomain; capture repro steps and expected states.
