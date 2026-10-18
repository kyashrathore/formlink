---
name: formlink
description: Build forms, surveys, quizzes, waitlists, lead capture, applications, sign-ups, booking or payment forms, and dashboards or private views over form responses, backed by Formlink (headless forms backend on Cloudflare). Use when the user wants to collect responses, take payments or verify emails/phones on a form, score a quiz, route leads, send form data to Slack/Sheets/Airtable/Notion/email, host a form page or response dashboard, or mentions Formlink, @formlink/sdk or the formlink CLI.
---

# Formlink

Formlink is a headless forms backend. It never renders a form.

- **Formlink owns:** submission storage, drafts/partials, uploads, funnel analytics, OTP verification,
  Stripe payment checks, per-form hook scripts (sandboxed, with encrypted secrets), and hosting
  (public sites, private views with share links, custom domains).
- **You own every pixel:** questions, layout, branching, progress, validation messages, thank-you
  screens, dashboards. You write that UI in any stack and point it at the Formlink API.

A form has **no field schema**. A submission is free JSON `data` you choose the keys for, plus
server-written `computed`, `meta`, `verified`, `payment`, `status` and `files`.

## The one decision rule

> Anything that must be **trusted**, **secret**, or **survive the browser** goes in the form's **hook**.
> Everything the respondent **sees** is **UI code**.

| Goes in the hook (server) | Goes in the UI (browser) |
|---|---|
| Required-field / business validation you rely on | Inline validation for fast feedback |
| Quiz answer key and score | Showing the score returned in `computed` |
| Price calculation (`price`) | Rendering the price and Stripe Elements |
| Emails, Slack, Sheets, Airtable, Notion, webhooks | Thank-you screen |
| API keys (`ctx.secrets`) | Nothing secret, ever |
| Lead status / routing, approval side effects | Branching / skip logic, progress bar |
| OTP delivery (`sendVerification`) | Code entry screen |

Branching is a plain function of answers in the UI. If a branch decision must be trusted (e.g.
eligibility), recompute it in `beforeSubmit`.

## Workflow

Do these in order. Each step names the MCP tool; REST/SDK/CLI equivalents are in `references/api.md`.

1. **Create the form** — `create_form { name, settings? }` → `frm_...`.
   Set settings only when needed: `uploads.allowedTypes`, `verification`, `payment`, `turnstile`,
   `allowedOrigins`, `retentionDays`, `maxSubmissions`, `closesAt`.
2. **Write the UI** — default to a single self-contained `index.html` (inline CSS/JS, ESM import of
   the SDK). Typeform-style (one question at a time) or Tally-style (one document page).
   Patterns: `references/building-forms.md`.
3. **Wire the SDK** in this order:
   - `const form = createForm({ formId })` — session id persists in sessionStorage.
   - `await form.info()` → if `!open`, show a closed message; read `uploads`, `verification`, `payment`, `turnstile`.
   - `form.track("view")` on load, `form.track("start")` on first answer, `form.track("step", id)` when each step is shown.
   - `form.saveDraft(answers)` when a step is completed (not on every keystroke).
   - `form.upload(file)` for files/signatures; put the returned `id` into `data`.
   - `form.submit(data, opts)` → `{ id, status, computed }`.
   - Catch `FormlinkError`: show `fieldErrors[key]` next to the matching question, otherwise `message`.
     Treat `code === "already_submitted"` as success.
4. **Hook if needed** — write one ES module with the exports you need (`beforeSubmit`,
   `afterSubmit`, `onStatusChange`, `price`, `sendVerification`). Store keys first with
   `set_secret`. Recipes: `references/hooks.md`.
5. **Test the hook** — `test_hook { formId, event, input, code }` with the unsaved code until the
   result is right, then `set_hook`. Debug live failures with `list_hook_runs`.
   `test_hook` performs real `fetch` calls: use test addresses/channels.
6. **Deploy** — `create_site { name, slug? }` then `deploy_site { siteId, files }` (must include
   `index.html`). On hosted sites call the API with relative URLs (SDK default `baseUrl: ""`).
   Hosting outside Formlink: pass `baseUrl` and add the page origin to `allowedOrigins`.
   Details: `references/hosting-and-views.md`.
7. **Smoke-test** — open the URL, submit once, then `query_submissions` and `list_hook_runs`.
8. **Share** the site `url` (public) or `shareUrl` (private).
9. **Later** — `query_submissions` / `get_submission` / `get_analytics` to answer questions about
   responses; `update_submission { status }` for approvals (runs `onStatusChange`). For a
   dashboard, `save_view { name, dataForms, html }` once, then `show_view { siteId }` renders it in
   the chat and its `shareUrl` opens it in a browser. Next time, `list_sites` + `show_view` instead
   of rebuilding.

## Connecting

Pick the first that is available:

1. **MCP** (preferred for agents). Endpoint `<api>/mcp`.
   - Claude Code: `claude mcp add --transport http formlink <api>/mcp --header "Authorization: Bearer fl_sk_..."`
   - claude.ai / other OAuth clients: add `<api>/mcp` as a custom connector; the consent page asks for
     an API key once.
   - Call the `guide` tool first if unsure about anything; it is the server's own contract.
2. **CLI** `formlink` (good in a repo: hook files under version control, `deploy <dir>`).
   Config from `FORMLINK_API_KEY` / `FORMLINK_URL` or `~/.formlink.json`.
   `formlink signup <name> --url <api>` creates a workspace and stores the key.
3. **SDK** `@formlink/sdk`: `createForm` in the browser (public, no key); `createAdmin({ apiKey, baseUrl })`
   in Node/scripts only.
4. **REST**: `<api>/v1/...` with `Authorization: Bearer fl_sk_...` for admin routes.

No workspace yet: `POST <api>/v1/workspaces { "name": "..." }` (no auth; may need `signupToken`)
returns `key.secret` once. Store it; it is never shown again.

Never put an `fl_sk_` key in browser code. Browsers only use the public API (`/v1/f/:formId/...`)
or a private view's share-link cookie (read-only).

## Hard rules

- Data keys you submit are the contract between UI, hook and views. Pick stable snake_case keys
  (`email`, `company_size`) and reuse them everywhere; `fieldErrors` keys must match them.
- Only submit answers to questions that were actually shown (drop hidden-branch answers).
- Never trust prices, scores or eligibility from the browser: compute them in the hook.
- Amounts are integers in minor units (`4900` = $49.00).
- Submission `data` ≤ 512KB, `meta` ≤ 16KB. Files go through `upload`, never base64 in `data`.
- One session submits once (409 `already_submitted`). Call `form.reset()` to allow another response.
- Public writes are rate-limited to 60/min per IP per form: save drafts per step, not per keystroke.
- Hooks are a single ES module, `fetch` only, no imports. Throwing in `beforeSubmit` rejects (422).
- `afterSubmit` runs after the response is sent and is not retried: check `list_hook_runs`.
- Escape respondent data when rendering it in views (use `textContent`).
- If the user's request needs something Formlink does not do (e.g. logic on a schedule,
  multi-form joins), say so plainly instead of faking it.

## Reference index

| File | Read when |
|---|---|
| `references/building-forms.md` | Writing any form UI: full Typeform-style single file (keyboard nav, progress, branching, drafts, step events, upload, signature, matrix, field errors), Tally-style page, embedding, Turnstile, email OTP, Stripe Elements, hidden fields/UTM, accessibility |
| `references/hooks.md` | Writing a hook: exact contract and return shapes, testing/debugging, secrets, recipes (validation, quiz scoring, lead routing, webhook, Slack, Resend, OTP via Resend/Twilio, Google Sheets, Airtable upsert, Notion, approvals, Stripe price tiers) |
| `references/hosting-and-views.md` | Deploying, SPA fallback, rollbacks, custom domains, saved views (in chat and by link), private views and a complete dashboard example, share links |
| `references/api.md` | Exact endpoints, MCP tools, SDK/CLI mapping, error codes, limits, retention |
