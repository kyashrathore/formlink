/**
 * The integration guide served at /llms.txt and by the MCP `guide` tool.
 * Formlink owns data and trusted server logic; the user's AI owns every pixel.
 */
export const GUIDE = String.raw`# Formlink

Headless forms infrastructure. Formlink stores submissions and runs trusted per-form logic.
You (the AI) build the form UI, any branching and the views. Formlink never renders a form.

## Model
- Workspace: owns forms, sites, secrets and API keys (fl_sk_..., role admin or read).
- Form: a named bucket with server-side settings. No field schema; submissions are free JSON.
- Submission: { id, status, data, computed, meta, verified, payment, files }.
  status is "draft" (partial), "complete", or any custom status ("approved", "rejected"...).
- Hook: one ES module per form, run in a sandboxed Dynamic Worker. Versioned.
- Secret: encrypted workspace value (STRIPE_SECRET_KEY, RESEND_API_KEY...). Hooks read ctx.secrets.
- Site: a hosted static app (form page, dashboard, view) at its own URL; private sites use a share link.

## Form settings (PATCH /v1/forms/:id { settings })
allowedOrigins: string[]   browser origins allowed to submit (empty = any)
turnstile: boolean         require a Cloudflare Turnstile token (secret TURNSTILE_SECRET_KEY)
retentionDays: number      auto-delete submissions and files
uploads: { maxBytes, allowedTypes }  default 10MB, any type ("image/" prefixes allowed)
verification: "email"|"sms" require a verified contact (code delivered by the sendVerification hook)
payment: boolean           require a succeeded Stripe PaymentIntent (amount from the price hook)
maxSubmissions, closesAt   close automatically

## Public API (browser, no key) base: <api>/v1/f/:formId
GET    /                          { id, name, open, turnstile, verification, payment, uploads }
PUT    /drafts/:sessionId         { data, meta? }  save partial answers (drop-off capture)
POST   /uploads?sessionId=&name=  raw file body with Content-Type -> { id, name, type, size }
POST   /events                    { sessionId, events: [{ type: view|start|step|complete, step? }] }
POST   /verify                    { channel: email|sms, to } -> { id }
POST   /verify/check              { id, code } -> { token }
POST   /payments                  { sessionId, data } -> { clientSecret, paymentIntentId, amount, currency }
POST   /submissions               { data, sessionId?, meta?, turnstileToken?, verificationToken?, paymentIntentId? }
                                  -> 201 { id, status, computed } | 422 { error: { details: { errors } } }
Uploads made with a sessionId attach to that session's submission. Put file ids in data if you need to reference them.

## Admin API (Authorization: Bearer fl_sk_...) base: <api>/v1
POST /workspaces { name } (no auth) -> { workspace, key: { secret } }
GET /me | GET,POST /keys | DELETE /keys/:id
GET,POST /forms | GET,PATCH,DELETE /forms/:id
GET,PUT /forms/:id/hook { code } | POST /forms/:id/hook/test { event, input, code? } | GET /forms/:id/hook/runs
GET /forms/:id/submissions?status=&drafts=&since=&until=&q=&limit=&cursor=
GET /forms/:id/export?format=csv|json | GET /forms/:id/analytics?since=&until=
GET,PATCH,DELETE /submissions/:id   PATCH { status?, data?, computed? } (status change runs onStatusChange)
GET /secrets | PUT /secrets/:NAME { value } | DELETE /secrets/:NAME
GET,POST /sites | GET,PATCH,DELETE /sites/:id
POST /sites/:id/deployments { files: { "index.html": { content }, "logo.png": { content, encoding: "base64" } } }
GET /sites/:id/deployments | POST /sites/:id/rollback { deploymentId }
POST /sites/:id/domains { hostname } | GET,DELETE /domains/:hostname
GET /files/:id (key or signed ?token=)

## Hooks
export default {
  // Before a submission is stored. Throw, or return { errors: { field: "message" } }, to reject (HTTP 422).
  // Return { computed: {...} } to store trusted values (scores, totals), { status } to set a status.
  async beforeSubmit({ submission, form }, ctx) {},
  // After storing. Side effects: webhooks, email, Sheets, Airtable, Slack. May return { computed, status }.
  async afterSubmit({ submission, form }, ctx) {},
  // After an admin or agent changes status (approval flows).
  async onStatusChange({ submission, previousStatus, form }, ctx) {},
  // Server-side price for Stripe. Amount in minor units.
  async price({ data, sessionId, form }, ctx) { return { amount: 4900, currency: "usd" } },
  // Deliver an OTP code by email or SMS with your provider.
  async sendVerification({ channel, to, code, form }, ctx) {},
}
ctx.secrets: workspace secrets. fetch() works for outbound calls. console.log output is kept in hook runs.
afterSubmit and onStatusChange that throw are retried (1m, 5m, 30m, 2h, 12h); the event carries attempt (1-based).
In afterSubmit/onStatusChange, submission.files carries signed download URLs.
Always run POST /forms/:id/hook/test before relying on a hook, and read GET /forms/:id/hook/runs when debugging.

## Building the UI
- Any stack. Generate a sessionId per attempt (crypto.randomUUID()) and keep it in sessionStorage.
- Send view/start/step events for funnels; save drafts on each step for partial submissions.
- Branching, scoring display, matrix and signature questions are UI code you write.
- Recompute anything that must be trusted (prices, scores) in beforeSubmit.
- Deploy to Formlink hosting with POST /sites/:id/deployments, or host anywhere and add the origin to allowedOrigins.
- On a Formlink-hosted site, call the API with relative URLs (/v1/f/...): same origin, no CORS.
- Private views (dashboards): create a private site with dataForms: [formId] and send header x-formlink-site: <slug>;
  the page may then GET /v1/forms/:id/submissions and /analytics with the share-link cookie, read-only.
- Saved views (dashboards over the data): MCP save_view { name, dataForms, html } then show_view { siteId }
  renders it inside the chat (MCP App) and its shareUrl opens it in a browser. The page includes
  <script src="/_formlink/view.js"></script> and reads data only via await formlink.call(tool, args) with
  list_forms, get_form, query_submissions, get_submission, get_analytics or export_submissions.
- Delayed payments (bank debits): a submission paid with a still-processing PaymentIntent is stored as
  "pending_payment"; POST <api>/v1/stripe/<workspaceId> (secret STRIPE_WEBHOOK_SECRET) settles it.
- SDK: npm i @formlink/sdk  (createForm, createAdmin). Agent skill: skills/formlink in the Formlink repo.
`;
