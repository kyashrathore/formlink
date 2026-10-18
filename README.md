# Formlink

Headless, AI-first forms infrastructure on Cloudflare.

Formlink owns the parts of a form that have to be trusted: storing answers, server-side checks, secrets, payments, verification, integrations and hosting. It owns **no UI**. Your AI builds the form (Typeform-style, Tally-style, an embed, a quiz, a dashboard) and talks to Formlink through the SDK, the REST API or MCP.

| Formlink runs it | Your AI builds it |
|---|---|
| Submission store, drafts/partials, uploads (R2) | The respondent experience: layout, questions, theme |
| Per-form hook scripts in sandboxed Dynamic Workers | Branching and conditional logic |
| Encrypted secrets for hooks | Matrix, signature and any other question type |
| Email/SMS OTP verification, Stripe payments | Prefill, hidden fields, embeds |
| Trusted scoring, webhooks, Sheets/Airtable/Slack via hooks | Views and dashboards over the data |
| Funnel analytics, retention, export, team keys | |
| Hosting for the app you build, private views, custom domains | |

## Layout

```
apps/api         Cloudflare Worker: REST API, MCP server, OAuth, hooks runtime, site hosting
packages/sdk     @formlink/sdk: createForm (browser) and createAdmin (server / private views)
packages/cli     formlink CLI: hooks, secrets, submissions, deploys
skills/formlink  Agent skill: how an AI builds forms, hooks and views on Formlink
```

## How it works

- **Forms** are buckets with server-side settings (allowed origins, Turnstile, verification, payment, uploads, retention, limits). There is no field schema; `data` is whatever your app sends.
- **Hooks** are one ES module per form, versioned, run in a [Dynamic Worker](https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/) with the workspace secrets: `beforeSubmit` (validate, compute trusted values, reject), `afterSubmit` (side effects), `onStatusChange` (approvals), `price` (Stripe amount), `sendVerification` (deliver OTP codes).
- **Sites** host the static app your AI builds at `<slug>.<SITES_DOMAIN>` (or `/s/<slug>/`), with rollbacks and custom domains through Cloudflare for SaaS. Hosted pages call the API on the same origin. Private sites open with a share link and can read the submissions of the forms they list in `dataForms`, read-only.
- **MCP**: `POST /mcp`, stateless Streamable HTTP. claude.ai and other clients connect with OAuth (the consent page asks for an API key once); Claude Code and scripts can send the key as a bearer token.
- **`/llms.txt`** serves the integration guide; the MCP `guide` tool returns the same text.

## Run locally

```sh
pnpm install
cd apps/api
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev                       # http://localhost:8787
```

In another shell:

```sh
pnpm -C apps/api test:e2e      # full flow: hooks, drafts, uploads, OTP, sites, private views, MCP
pnpm -C packages/sdk build && pnpm -C packages/sdk test
pnpm -C packages/cli build && pnpm -C packages/cli test
```

## Deploy to Cloudflare

```sh
cd apps/api
npx wrangler d1 create formlink           # put the id in wrangler.jsonc
npx wrangler r2 bucket create formlink-files
npx wrangler kv namespace create OAUTH_KV # put the id in wrangler.jsonc
openssl rand -base64 32 | npx wrangler secret put SECRETS_KEY
openssl rand -hex 32 | npx wrangler secret put SIGNING_KEY
npx wrangler secret put SIGNUP_TOKEN      # optional: gate workspace creation
pnpm db:migrate
pnpm run deploy
```

Then set `PUBLIC_URL` in `wrangler.jsonc`. For hosted sites on their own subdomains, route `*.<SITES_DOMAIN>/*` to the Worker and set `SITES_DOMAIN`. For custom domains, enable Cloudflare for SaaS on that zone, set `CF_ZONE_ID`, add a `CF_API_TOKEN` secret with Custom Hostnames edit permission, and point the zone's fallback origin at the Worker.

## Use it

Create a workspace and connect your AI:

```sh
npx formlink signup "Acme" --url https://forms.example.com
claude mcp add --transport http formlink https://forms.example.com/mcp --header "Authorization: Bearer fl_sk_..."
```

In claude.ai, add `https://forms.example.com/mcp` as a custom connector and paste the key on the consent page.

In the app your AI builds:

```js
import { createForm } from "@formlink/sdk";

const form = createForm({ formId: "frm_..." }); // same origin when hosted on Formlink
form.track("view");
await form.saveDraft({ email });                 // partial answers
const { id, computed } = await form.submit({ email, budget });
```

On a server or in a script:

```js
import { createAdmin } from "@formlink/sdk";

const admin = createAdmin({ baseUrl: "https://forms.example.com", apiKey: process.env.FORMLINK_API_KEY });
await admin.hooks.set(formId, `export default { async afterSubmit({ submission }, ctx) { /* ... */ } }`);
const rows = await admin.submissions.all(formId);
```

The agent skill in [`skills/formlink`](skills/formlink/SKILL.md) teaches an AI the whole workflow, with recipes for Typeform- and Tally-style forms, hooks for common integrations, and private dashboards.

## Limits

Submission data 512KB, client meta 16KB, uploads 10MB by default (up to 100MB per form), deployments 25MB and 1000 files, public endpoints 60 requests per minute per IP per form, OTP codes 6 digits valid 10 minutes with 5 attempts, drafts kept 30 days, events 180 days, hook runs 30 days.
