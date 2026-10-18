# API reference

`<api>` is the Formlink origin (e.g. `https://formlink.example.com`). The live contract is also at
`<api>/llms.txt` and via the MCP `guide` tool.

## Public API (browser, no key) — `<api>/v1/f/:formId`

| Method | Path | Body / query | Response | SDK |
|---|---|---|---|---|
| GET | `/` | — | `{ id, name, open, turnstile, verification, payment, uploads: { maxBytes, allowedTypes } }` | `form.info()` |
| PUT | `/drafts/:sessionId` | `{ data, meta? }` | `{ id, status: "draft" }` | `form.saveDraft(data, meta?)` |
| POST | `/uploads?sessionId=&name=` | raw body; `Content-Type`, `Content-Length` required | 201 `{ id, name, type, size }` | `form.upload(file)` |
| POST | `/events` | `{ sessionId, events: [{ type: "view"\|"start"\|"step"\|"complete", step? }] }` (1–20, step ≤ 100 chars) | 204 | `form.track(type, step?)` |
| POST | `/verify` | `{ channel: "email"\|"sms", to }` | 201 `{ id, expiresAt }` | `form.verify.start(channel, to)` |
| POST | `/verify/check` | `{ id, code }` | `{ token, channel, target }` | `form.verify.check(id, code)` |
| POST | `/payments` | `{ sessionId, data }` | 201 `{ paymentIntentId, clientSecret, amount, currency }` | `form.createPayment(data)` |
| POST | `/submissions` | `{ data, sessionId?, meta?, turnstileToken?, verificationToken?, paymentIntentId? }` | 201 `{ id, status, computed }` | `form.submit(data, opts)` |

- `sessionId`: 8–64 chars, one per respondent attempt; links draft, uploads, payment, events. The
  SDK generates and persists it (`form.sessionId`, `form.reset()`).
- Submit order of checks: open → size → Turnstile → verification → payment → already submitted →
  `beforeSubmit` → store → attach session uploads → `complete` event → `afterSubmit` (background).
- Submitting a session with a draft completes that draft (same id).
- Origin check: if `allowedOrigins` is non-empty and the request has an `Origin` not in it → 403.
- Rate limit: non-GET public requests, 60/min per IP per form → 429 `rate_limited`.

## Admin API — `<api>/v1`, `Authorization: Bearer fl_sk_...`

Keys have role `admin` or `read` (read: GET only, else 403). Private-site cookies act as `read`
scoped to the site's `dataForms`.

| Method & path | Body / query | Notes | SDK `admin.` | MCP |
|---|---|---|---|---|
| POST `/workspaces` (no auth) | `{ name, signupToken? }` | → 201 `{ workspace, key: { id, name, role, secret } }`; secret shown once | — (CLI `signup`) | — |
| GET `/me` | | `{ workspace, role }` | | `whoami` |
| GET, POST `/keys`; DELETE `/keys/:id` | `{ name, role? = "admin" }` | create returns `secret` once; a key can't revoke itself (409) | `keys.list/create/revoke` | — |
| GET, POST `/forms` | `{ name, status?, settings? }` | | `forms.list/create` | `list_forms`, `create_form` |
| GET, PATCH, DELETE `/forms/:id` | PATCH `{ name?, status?: "open"\|"closed", settings? }` | settings merge; `null` resets a key; DELETE removes submissions + files | `forms.get/update/delete` | `get_form`, `update_form`, `delete_form` |
| GET, PUT `/forms/:id/hook` | PUT `{ code }` | → `{ formId, version, exports, warnings }`; `""` removes | `hooks.get/set` | `get_hook`, `set_hook` |
| POST `/forms/:id/hook/test` | `{ event, input, code? }` | → `{ handled, result, error, logs }`; nothing stored, fetches are real | `hooks.test` | `test_hook` |
| GET `/forms/:id/hook/runs?limit=` | limit ≤ 100, default 20 | `[{ id, submissionId, event, version, ok, error, logs, durationMs, createdAt }]` | `hooks.runs` | `list_hook_runs` |
| GET `/forms/:id/submissions` | `status, drafts, since, until, q, limit (1–500, 50), cursor` | newest first → `{ submissions, nextCursor }`; drafts excluded unless `drafts` set or `status=draft`; `since/until` are ms on `createdAt`; `q` substring of answers JSON | `submissions.list` | `query_submissions` |
| GET `/forms/:id/export?format=csv\|json` | | all non-drafts (≤ 50,000); CSV: id, status, created_at, completed_at, data keys, `computed.*` | `submissions.export` | `export_submissions` |
| GET `/forms/:id/analytics?since=&until=` | ms; default last 30 days | `{ views, starts, completes, startRate, completionRate, steps: [{ step, sessions, dropOff }], daily: [{ day, count }] }` | `analytics(formId, range?)` | `get_analytics` |
| GET `/submissions/:id` | | includes `files[]` with signed URLs | `submissions.get` | `get_submission` |
| PATCH `/submissions/:id` | `{ status?, data?, computed? }` | data/computed shallow-merge; a status change runs `onStatusChange` | `submissions.update` | `update_submission` |
| DELETE `/submissions/:id` | | deletes files too | `submissions.delete` | `delete_submission` |
| GET `/secrets`; PUT, DELETE `/secrets/:NAME` | PUT `{ value }` | names only listed; 204 | `secrets.list/set/delete` | `list_secrets`, `set_secret`, `delete_secret` |
| GET, POST `/sites` | `{ name, slug?, visibility? = "public", dataForms? = [] }` | | `sites.list/create` | `list_sites`, `create_site` |
| GET, PATCH, DELETE `/sites/:id` | PATCH adds `rotateShareToken?: true` | | `sites.get/update/delete` | `update_site` |
| POST `/sites/:id/deployments` | `{ files: { path: { content, encoding?: "utf8"\|"base64", contentType? } } }` | 201 `{ deploymentId, files, bytes, site }` | `sites.deploy(siteId, files)` (values may also be plain strings or `Uint8Array`) | `deploy_site` |
| GET `/sites/:id/deployments` | | latest 50 `{ id, files, createdAt }` | `sites.deployments` | `list_deployments` |
| POST `/sites/:id/rollback` | `{ deploymentId }` | | `sites.rollback` | `rollback_site` |
| POST `/sites/:id/domains` | `{ hostname }` | 201 `{ hostname, status, dns: { type: "CNAME", name, target }, verification }` | `domains.add(siteId, hostname)` | `add_domain` |
| GET, DELETE `/domains/:hostname` | | GET refreshes status | `domains.get/remove` | `get_domain`, `remove_domain` |
| GET `/files/:id` | key, site cookie, or `?token=` | signed URLs from submissions last 7 days | — | — |

Form settings: `allowedOrigins: string[]`, `turnstile: boolean`, `retentionDays: int`,
`uploads: { maxBytes ≤ 100MB (default 10MB), allowedTypes: string[] ("image/" prefix ok) }`,
`verification: "email"|"sms"`, `payment: boolean`, `maxSubmissions: int`, `closesAt: ms epoch`.

Submission: `{ id, formId, sessionId, status, data, computed, meta, verified, payment, createdAt, updatedAt, completedAt }` (+ `files` on single get).
Status values: `draft`, `complete` (default), or any `^[a-z][a-z0-9_-]{0,31}$`.

## MCP

Endpoint `<api>/mcp` (Streamable HTTP, stateless JSON-RPC). Auth: `Authorization: Bearer fl_sk_...`
or OAuth (consent page asks for an API key once). Read keys can call read-only tools only.

`guide`, `whoami`, `list_forms`, `get_form` (adds `publicEndpoint`), `create_form`, `update_form`,
`delete_form`, `query_submissions`, `get_submission`, `update_submission`, `get_analytics`,
`get_hook`, `set_hook`, `test_hook`, `list_hook_runs`, `list_secrets`, `set_secret`,
`delete_secret`, `list_sites`, `create_site`, `update_site`, `deploy_site`, `rollback_site`,
`add_domain`, `get_domain`, `export_submissions`, `delete_submission`, `list_deployments`,
`delete_site`, `remove_domain`, `save_view`, `show_view` (renders a saved view in the chat as an MCP App: `_meta.ui.resourceUri = ui://formlink/view`).

Not in MCP (use REST/SDK/CLI): API keys and workspace signup. Tool errors come back as `isError: true` with text `code: message`.

## Stripe webhook

`POST <api>/v1/stripe/<workspaceId>`: point a Stripe webhook here (events `payment_intent.succeeded`,
`payment_intent.payment_failed`) and store its signing secret as `STRIPE_WEBHOOK_SECRET`. Needed only for
delayed payment methods: a submission whose PaymentIntent is still `processing` is stored with status
`pending_payment` and afterSubmit waits. On success it gets the status it would have had and afterSubmit runs;
on failure it becomes `payment_failed` and onStatusChange runs.

## CLI

```text
formlink signup <name> [--url]          formlink login <key> [--url]
formlink forms                          formlink form create <name>
formlink submissions <formId> [--status s] [--limit n] [--json]
formlink export <formId> [--format csv|json]
formlink hook pull <formId> [file]      formlink hook push <formId> <file>
formlink hook test <formId> <event> <json|@file> [--code file]
formlink hook runs <formId>
formlink secrets                        formlink secret set NAME [value]
formlink sites                          formlink site create <name> [--slug s] [--private] [--data formId,...]
formlink deploy <dir> --site <siteId>   formlink domain add <siteId> <hostname>
```

Config: `FORMLINK_API_KEY`, `FORMLINK_URL`, or `~/.formlink.json`.

## Errors

Every error: `{ "error": { "code": string, "message": string, "details"?: any } }`.
SDK: `FormlinkError { status, code, message, details, fieldErrors? }` (`fieldErrors` = `details.errors` on 422 `invalid`).

| Status | Code | Raised when |
|---|---|---|
| 400 | `bad_request` | invalid JSON/body (`details: [{ path, message }]`), meta > 16KB, missing Turnstile token, bad email/phone, incorrect OTP code, invalid `paymentIntentId` or one from another form/session, upload without `sessionId`/`Content-Length`, form without `payment` on `/payments`, hook fails to load (`details.error`), hook > 256KB, bad secret name / value > 8KB, bad slug/path/hostname, deploy without `index.html` or > 1000 files |
| 401 | `unauthorized` | missing/invalid/revoked key; private view without cookie |
| 402 | `payment_required` | `payment: true` and no `paymentIntentId`/`sessionId`, or PaymentIntent not `succeeded` |
| 402 | `payment_mismatch` | the amount paid differs from `price()` for the answers actually submitted |
| 403 | `forbidden` | origin not in `allowedOrigins`; read-only key/view writing; form outside a view's `dataForms`; signup without valid `signupToken` |
| 403 | `verification_required` | form requires verification and token missing/invalid/wrong channel |
| 403 | `turnstile_failed` | Turnstile rejected the token |
| 404 | `not_found` | form, submission, hook (test with nothing saved), file, site, deployment, domain, secret, key; OTP expired/unknown; unknown route |
| 409 | `already_submitted` | session already has a complete submission (submit or draft) |
| 409 | `conflict` | PaymentIntent already used; slug taken; hostname already connected; key revoking itself |
| 410 | `closed` | form `closed`, past `closesAt`, or `maxSubmissions` reached |
| 413 | `too_large` | data > 512KB; file > `uploads.maxBytes`; deployment > 25MB |
| 415 | `unsupported_type` | file type not in `uploads.allowedTypes` |
| 422 | `invalid` | `beforeSubmit` returned `{ errors }` → `details.errors` |
| 422 | `rejected` | `beforeSubmit` threw → message is the error's first line |
| 429 | `rate_limited` | public rate limit; > 5 OTP codes per target per 10 min; > 5 wrong code attempts |
| 500 | `internal` | unexpected server error |
| 501 | `not_configured` | missing `STRIPE_SECRET_KEY` / `TURNSTILE_SECRET_KEY`; no `price` / `sendVerification` hook; custom domains not configured on the server |
| 502 | `hook_failed` | `price` hook threw or returned a bad shape |
| 502 | `delivery_failed` | `sendVerification` hook threw |
| 502 | `stripe_error` | Stripe API error (message passed through) |
| 502 | `cloudflare_error` | custom hostname API error |

## Limits

| Thing | Limit |
|---|---|
| Submission `data` | 512KB (JSON) |
| `meta` from client | 16KB |
| Upload | default 10MB, configurable up to 100MB per form |
| Events per request | 20 |
| Public rate limit | 60 non-GET requests / min / IP / form |
| OTP | 6 digits, valid 10 min, 5 attempts per code, 5 codes per target per 10 min; token valid 1 h |
| Hook | 256KB code, 30 s per call, 200 log lines × 2000 chars |
| Secrets | `UPPER_SNAKE_CASE` ≤ 64 chars, value ≤ 8KB, workspace-wide |
| Deploy | 1000 files, 25MB total, `index.html` required; deployments list shows latest 50 |
| Site slug | 3–40 chars `a-z0-9-` |
| Private view cookie | 30 days; invalidated by rotating the share link |
| Signed file URLs | 7 days |
| List page | 1–500 (default 50); export ≤ 50,000 rows |
| Analytics default range | last 30 days |

## Retention (daily job)

- `retentionDays` set: submissions (any status) older than N days by `createdAt` are deleted with their files.
- Drafts not updated for 30 days are deleted; uploads never attached to a submission are deleted after 30 days.
- Events (funnel data) kept 180 days; hook runs 30 days; expired OTP records 1 day.
- Deleting a form deletes its submissions, files and hook; deleting a site deletes its deployments and domains.
