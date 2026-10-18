# Hooks

A hook is **one ES module per form** with a default-exported object. Every export is optional.
It runs in a sandboxed Dynamic Worker: `fetch`, Web Crypto, `URL`, `TextEncoder`, `btoa`/`atob`
are available. **No `import` statements, no npm packages, no Node APIs.** Helper functions and
constants at module top level are fine.

## Contract (as implemented)

```js
export default {
  async beforeSubmit({ submission, form }, ctx) {},
  async afterSubmit({ submission, form }, ctx) {},
  async onStatusChange({ submission, previousStatus, form }, ctx) {},
  async price({ data, sessionId, form }, ctx) {},
  async sendVerification({ channel, to, code, form }, ctx) {},
};
```

`form` is always `{ id, name, settings }`. `ctx` is `{ secrets, log }`: `ctx.secrets.NAME` is the
decrypted workspace secret (or `undefined`); `ctx.log(...)` is the same as `console.log`.

| Event | When | Input `submission` | Return | Effect of throwing |
|---|---|---|---|---|
| `beforeSubmit` | Before the submission is stored, after Turnstile/verification/payment checks | `{ id, sessionId, data, meta, verified, payment }` (no `status`, no `files`) | `{ errors: { key: msg } }` → 422 `invalid` with `details.errors` (SDK `fieldErrors`). `{ computed }` stored and returned to the browser. `{ status }` sets the initial status (default `"complete"`). | 422 `rejected`, message = first line of the error (leading `Error: ` stripped) |
| `afterSubmit` | After storing, in the background (respondent already has the 201) | full stored submission + `files` | `{ computed }` shallow-merged, `{ status }` replaced | a throw is retried by the 5-minute cron after 1m, 5m, 30m, 2h, 12h; `attempt` (1-based) is passed in so you can stay idempotent |
| `onStatusChange` | After an admin/agent changes `status` (`update_submission`, `PATCH /v1/submissions/:id`, `admin.submissions.update`) | full submission (new status) + `files`; `previousStatus`; `attempt` | same as afterSubmit | retried like afterSubmit |
| `price` | `POST /payments` (`form.createPayment`) | — (`data`, `sessionId` are top-level) | `{ amount, currency, description? }`; amount positive integer in minor units | 502 `hook_failed` |
| `sendVerification` | `POST /verify` (`form.verify.start`) | — (`channel` `"email"|"sms"`, `to` normalized: lowercased email or E.164 phone, `code` 6 digits) | ignored | 502 `delivery_failed`, no code stored |

Full stored submission shape (afterSubmit / onStatusChange):

```js
{ id, formId, sessionId, status, data, computed, meta, verified /* {channel,target}|null */,
  payment /* {id,amount,currency,status}|null */, createdAt, updatedAt, completedAt,
  files: [{ id, name, type, size, url /* signed, 7 days */ }] }
```

`meta` contains client meta (UTM and other query params, `$url`, `$referrer`, your extras) plus `$origin`, `$referer`, `$userAgent`, `$country`.

Details that matter:

- Only `beforeSubmit`'s `computed` comes back in the submit response. Anything the respondent must
  see (score, result tier) must be computed in `beforeSubmit`.
- `errors` with zero keys is ignored. Keys should equal your `data` keys / question ids.
- `status` must match `^[a-z][a-z0-9_-]{0,31}$`; invalid values are ignored.
- A status set by `afterSubmit`/`onStatusChange` return values does **not** fire `onStatusChange`
  again (no loops). Only explicit admin updates fire it.
- Timeout 30s per call. Code ≤ 256KB. `console.*` captured: 200 lines × 2000 chars per run.
- `set_hook` loads the module first: syntax errors → 400 `bad_request` "Hook failed to load"
  (`details.error`). Unknown exports are saved with a warning and never called.
- Each `set_hook` creates a new version; there is no rollback endpoint — re-save older code. Keep the
  hook in a file (`formlink hook pull <formId> hook.js`, edit, `formlink hook push <formId> hook.js`).
- `set_hook` with empty code removes the hook.
- Secrets are workspace-wide (all forms), names `UPPER_SNAKE_CASE` ≤ 64 chars, values ≤ 8KB. Changes
  apply to the next run. Use descriptive names: `RESEND_API_KEY`, `SLACK_WEBHOOK_URL`, `SALES_SLACK_WEBHOOK_URL`.
- Fail loudly: if a required secret is missing, `throw new Error("Set the RESEND_API_KEY secret")`.
  Check `res.ok` on every `fetch` and throw with the response body, so hook runs show the cause.
- One module per form: when combining recipes, merge the handlers into one default export.

## Test, save, debug

1. Write the code to a file. 2. `test_hook` with `code` (unsaved) and a realistic `input`. 3. Fix
until `error` is null and `result`/`logs` look right. 4. `set_hook`. 5. Submit once for real and
check `list_hook_runs`.

`test_hook` returns `{ handled, result, error, logs }` (`handled: false` = no such export). It stores
nothing, but **its `fetch` calls are real**: emails send, rows append. Use your own address / a test
channel. `form` is filled in automatically; pass the rest:

| Event | `input` |
|---|---|
| beforeSubmit | `{ "submission": { "id": "sub_test", "data": { "email": "me@example.com" }, "meta": {}, "verified": null, "payment": null } }` |
| afterSubmit | `{ "submission": { "id": "sub_test", "status": "complete", "data": {...}, "computed": {}, "meta": {}, "files": [] } }` |
| onStatusChange | `{ "submission": { "id": "sub_test", "status": "approved", "data": {...} }, "previousStatus": "complete" }` |
| price | `{ "data": { "plan": "pro", "seats": 3 } }` |
| sendVerification | `{ "channel": "email", "to": "me@example.com", "code": "123456" }` |

CLI: `formlink hook test <formId> beforeSubmit @input.json --code hook.js`, `formlink hook runs <formId>`.
Hook runs keep `event`, `ok`, `error`, `logs`, `durationMs`, `submissionId`, `version` for 30 days.

---

## Recipes

Each recipe is a complete module. Merge handlers when you need several.

### Required fields and validation

```js
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED = { name: "Please enter your name", email: "Please enter your email", role: "Pick one" };

export default {
  async beforeSubmit({ submission }) {
    const d = submission.data;
    const errors = {};
    for (const [key, msg] of Object.entries(REQUIRED)) {
      if (d[key] === undefined || d[key] === null || String(d[key]).trim() === "") errors[key] = msg;
    }
    if (d.email && !EMAIL.test(String(d.email))) errors.email = "That email doesn't look right";
    if (d.role === "Other" && !d.role_other) errors.role_other = "Tell us your role";
    if (d.team_size !== undefined && (!Number.isInteger(d.team_size) || d.team_size < 1)) errors.team_size = "Enter a whole number";
    if (/@(mailinator|guerrillamail)\./i.test(String(d.email ?? ""))) throw new Error("Please use a real email address");
    if (Object.keys(errors).length) return { errors };
    return { computed: { email_domain: String(d.email).split("@")[1].toLowerCase() } };
  },
};
```

### Quiz scoring (answer key never reaches the browser)

```js
const KEY = { q1: "b", q2: "d", q3: ["a", "c"], q4: "true" };
const PASS = 0.7;

const correct = (given, expected) =>
  Array.isArray(expected)
    ? Array.isArray(given) && given.length === expected.length && expected.every((x) => given.includes(x))
    : given === expected;

export default {
  async beforeSubmit({ submission }) {
    const d = submission.data;
    const results = Object.fromEntries(Object.entries(KEY).map(([q, exp]) => [q, correct(d[q], exp)]));
    const score = Object.values(results).filter(Boolean).length;
    const total = Object.keys(KEY).length;
    return {
      computed: { score, total, percent: Math.round((score / total) * 100), passed: score / total >= PASS, results },
      status: score / total >= PASS ? "passed" : "failed",
    };
  },
};
```

The browser reads `res.computed.score` / `res.computed.passed` from `form.submit`.

### Lead routing by status

```js
const score = (d) =>
  (Number(d.budget) >= 10000 ? 40 : Number(d.budget) >= 2000 ? 20 : 0) +
  (Number(d.team_size) >= 50 ? 30 : Number(d.team_size) >= 10 ? 15 : 0) +
  (/(gmail|yahoo|hotmail|outlook)\./i.test(String(d.email)) ? 0 : 20);

export default {
  async beforeSubmit({ submission }) {
    const s = score(submission.data);
    return { computed: { lead_score: s }, status: s >= 60 ? "qualified" : s >= 30 ? "nurture" : "unqualified" };
  },
  async afterSubmit({ submission }, ctx) {
    if (submission.status !== "qualified") return;
    const url = ctx.secrets.SALES_SLACK_WEBHOOK_URL;
    if (!url) throw new Error("Set the SALES_SLACK_WEBHOOK_URL secret");
    const d = submission.data;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `Qualified lead (${submission.computed.lead_score}): ${d.name} <${d.email}>, budget ${d.budget}` }),
    });
    if (!res.ok) throw new Error(`Slack ${res.status}: ${await res.text()}`);
  },
};
```

Query by status later: `query_submissions { formId, status: "qualified" }`.

### Webhook POST (signed)

```js
async function hmacHex(key, body) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async afterSubmit({ submission, form }, ctx) {
    const { WEBHOOK_URL, WEBHOOK_SECRET } = ctx.secrets;
    if (!WEBHOOK_URL || !WEBHOOK_SECRET) throw new Error("Set WEBHOOK_URL and WEBHOOK_SECRET");
    const body = JSON.stringify({ event: "submission.created", form: { id: form.id, name: form.name }, submission });
    const t = Math.floor(Date.now() / 1000);
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-formlink-signature": `t=${t},v1=${await hmacHex(WEBHOOK_SECRET, `${t}.${body}`)}` },
      body,
    });
    if (!res.ok) throw new Error(`Webhook ${res.status}: ${(await res.text()).slice(0, 500)}`);
  },
};
```

Receivers verify `HMAC_SHA256(secret, "<t>.<raw body>")` and reject old `t`. There is no retry:
make receivers idempotent on `submission.id` and re-send failures by hand from `list_hook_runs`.

### Slack incoming webhook

```js
export default {
  async afterSubmit({ submission, form }, ctx) {
    const url = ctx.secrets.SLACK_WEBHOOK_URL;
    if (!url) throw new Error("Set the SLACK_WEBHOOK_URL secret");
    const fields = Object.entries(submission.data)
      .filter(([, v]) => typeof v !== "object")
      .map(([k, v]) => `*${k}*: ${String(v).slice(0, 300)}`)
      .join("\n");
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `New response to ${form.name}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: `New response: ${form.name}` } },
          { type: "section", text: { type: "mrkdwn", text: fields || "_no answers_" } },
          ...(submission.files.length
            ? [{ type: "section", text: { type: "mrkdwn", text: submission.files.map((f) => `<${f.url}|${f.name}>`).join("\n") } }]
            : []),
        ],
      }),
    });
    if (!res.ok) throw new Error(`Slack ${res.status}: ${await res.text()}`);
  },
};
```

### Email via Resend: team notification + autoresponder

Secrets: `RESEND_API_KEY`, `NOTIFY_EMAIL`. The `from` domain must be verified in Resend.

```js
const FROM = "Acme Forms <forms@acme.com>";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function sendEmail(key, msg) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(msg),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

export default {
  async afterSubmit({ submission, form }, ctx) {
    const { RESEND_API_KEY, NOTIFY_EMAIL } = ctx.secrets;
    if (!RESEND_API_KEY || !NOTIFY_EMAIL) throw new Error("Set RESEND_API_KEY and NOTIFY_EMAIL");
    const d = submission.data;
    const rows = Object.entries(d)
      .map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</td></tr>`)
      .join("");
    await sendEmail(RESEND_API_KEY, {
      from: FROM,
      to: [NOTIFY_EMAIL],
      reply_to: d.email ? String(d.email) : undefined,
      subject: `New ${form.name} response from ${d.name ?? d.email ?? "someone"}`,
      html: `<table>${rows}</table>${submission.files.map((f) => `<p><a href="${f.url}">${esc(f.name)}</a></p>`).join("")}`,
    });
    if (d.email) {
      await sendEmail(RESEND_API_KEY, {
        from: FROM,
        to: [String(d.email)],
        subject: "We got your submission",
        html: `<p>Hi ${esc(d.name ?? "there")},</p><p>Thanks for reaching out. We'll reply within one business day.</p>`,
      });
    }
    return { computed: { emailed: true } };
  },
};
```

Only send the autoresponder to verified or low-risk addresses if abuse is a concern (set
`verification: "email"`), otherwise the form can be used to send mail to arbitrary people.

### sendVerification: email via Resend

```js
export default {
  async sendVerification({ channel, to, code, form }, ctx) {
    if (channel !== "email") throw new Error(`Unsupported channel ${channel}`);
    const key = ctx.secrets.RESEND_API_KEY;
    if (!key) throw new Error("Set the RESEND_API_KEY secret");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: "Acme <verify@acme.com>",
        to: [to],
        subject: `${code} is your ${form.name} code`,
        text: `Your verification code is ${code}. It expires in 10 minutes.`,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  },
  // Bind the verified address to the answer.
  async beforeSubmit({ submission }) {
    const email = String(submission.data.email ?? "").trim().toLowerCase();
    if (submission.verified?.target !== email) return { errors: { email: "Verify this email address first" } };
  },
};
```

### sendVerification: SMS via Twilio

Secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (E.164 number or Messaging Service SID `MG...`).

```js
export default {
  async sendVerification({ channel, to, code, form }, ctx) {
    if (channel !== "sms") throw new Error(`Unsupported channel ${channel}`);
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = ctx.secrets;
    if (!sid || !token || !from) throw new Error("Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM");
    const body = new URLSearchParams({ To: to, Body: `${code} is your ${form.name} code. It expires in 10 minutes.` });
    body.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { authorization: `Basic ${btoa(`${sid}:${token}`)}`, "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  },
  async beforeSubmit({ submission }) {
    const phone = String(submission.data.phone ?? "").replace(/[\s().-]/g, "");
    if (submission.verified?.target !== phone) return { errors: { phone: "Verify this phone number first" } };
  },
};
```

### Google Sheets append (Apps Script web app, no OAuth)

1. In the sheet: Extensions → Apps Script, paste, set `TOKEN` to a random string:

```js
// Apps Script (runs at Google, not in Formlink)
const TOKEN = "change-me-long-random";
const COLUMNS = ["submitted_at", "id", "name", "email", "role", "score"];
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.token !== TOKEN) return ContentService.createTextOutput("forbidden");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Responses");
  if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
  sheet.appendRow(COLUMNS.map((c) => body.row[c] ?? ""));
  return ContentService.createTextOutput("ok");
}
```

2. Deploy → New deployment → Web app, Execute as: Me, Who has access: Anyone. Copy the `/exec` URL.
3. `set_secret SHEETS_WEBAPP_URL <url>` and `set_secret SHEETS_TOKEN <same token>`.

```js
export default {
  async afterSubmit({ submission }, ctx) {
    const { SHEETS_WEBAPP_URL: url, SHEETS_TOKEN: token } = ctx.secrets;
    if (!url || !token) throw new Error("Set SHEETS_WEBAPP_URL and SHEETS_TOKEN");
    const d = submission.data;
    const row = {
      submitted_at: new Date(submission.completedAt ?? Date.now()).toISOString(),
      id: submission.id, name: d.name, email: d.email, role: d.role, score: submission.computed.score,
    };
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, row }) });
    const text = await res.text(); // Apps Script answers via a redirect; fetch follows it
    if (!res.ok || text !== "ok") throw new Error(`Sheets ${res.status}: ${text.slice(0, 300)}`);
  },
};
```

After editing the Apps Script, deploy a **new version** of the same deployment or the URL keeps running old code.

### Airtable create-or-update by email (upsert)

Secrets: `AIRTABLE_TOKEN` (personal access token with `data.records:write` on the base),
`AIRTABLE_BASE_ID` (`app...`). Table fields must exist (`Email`, `Name`, `Company`, `Source`, `Last submission`).

```js
export default {
  async afterSubmit({ submission }, ctx) {
    const { AIRTABLE_TOKEN: token, AIRTABLE_BASE_ID: base } = ctx.secrets;
    if (!token || !base) throw new Error("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID");
    const d = submission.data;
    if (!d.email) return;
    const res = await fetch(`https://api.airtable.com/v0/${base}/${encodeURIComponent("Leads")}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ["Email"] },
        typecast: true,
        records: [{ fields: {
          Email: String(d.email).toLowerCase(),
          Name: d.name ?? "",
          Company: d.company ?? "",
          Source: submission.meta.utm_source ?? "",
          "Last submission": submission.id,
        } }],
      }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${JSON.stringify(out)}`);
    return { computed: { airtable_record: out.records?.[0]?.id } };
  },
};
```

### Notion: create a database page

Secrets: `NOTION_TOKEN` (internal integration secret; share the database with the integration),
`NOTION_DATABASE_ID`. Property names/types must match the database (`Name` title, `Email` email,
`Role` select, `Message` rich text).

```js
export default {
  async afterSubmit({ submission }, ctx) {
    const { NOTION_TOKEN: token, NOTION_DATABASE_ID: db } = ctx.secrets;
    if (!token || !db) throw new Error("Set NOTION_TOKEN and NOTION_DATABASE_ID");
    const d = submission.data;
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "notion-version": "2022-06-28", "content-type": "application/json" },
      body: JSON.stringify({
        parent: { database_id: db },
        properties: {
          Name: { title: [{ text: { content: String(d.name ?? "Untitled") } }] },
          Email: { email: d.email ? String(d.email) : null },
          Role: d.role ? { select: { name: String(d.role) } } : { select: null },
          Message: { rich_text: [{ text: { content: String(d.about ?? "").slice(0, 2000) } }] },
        },
      }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(`Notion ${res.status}: ${out.message ?? JSON.stringify(out)}`);
    return { computed: { notion_url: out.url } };
  },
};
```

### Approval workflow (onStatusChange)

Submissions land as `pending`; a human or agent approves with `update_submission { submissionId, status: "approved" }`
(MCP), `admin.submissions.update(id, { status: "approved" })` (SDK) or `PATCH /v1/submissions/:id`.

```js
async function email(key, to, subject, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: "Acme <hello@acme.com>", to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export default {
  async beforeSubmit() {
    return { status: "pending" };
  },
  async onStatusChange({ submission, previousStatus }, ctx) {
    const key = ctx.secrets.RESEND_API_KEY;
    if (!key) throw new Error("Set the RESEND_API_KEY secret");
    const to = String(submission.data.email);
    if (submission.status === "approved" && previousStatus !== "approved") {
      await email(key, to, "You're in", "<p>Your application was approved. Welcome!</p>");
      return { computed: { approved_at: new Date().toISOString() } };
    }
    if (submission.status === "rejected" && previousStatus !== "rejected") {
      await email(key, to, "Your application", "<p>Thanks for applying. We can't offer a place this time.</p>");
      return { computed: { rejected_at: new Date().toISOString() } };
    }
  },
};
```

Review queue: `query_submissions { formId, status: "pending" }`.

### Stripe price hook with tiers

Settings `payment: true`, secret `STRIPE_SECRET_KEY`. Formlink creates the PaymentIntent with the
returned amount and verifies it succeeded before accepting the submission. Re-check in
`beforeSubmit` that the paid amount matches the submitted answers (the price was quoted from the
answers sent to `createPayment`, which can differ from those submitted).

```js
const PLANS = { starter: 1900, pro: 4900, team: 9900 }; // cents per seat per month
const VOLUME = [ { min: 50, off: 0.2 }, { min: 10, off: 0.1 }, { min: 1, off: 0 } ];
const ADDONS = { onboarding: 25000 };

function quote(d) {
  const unit = PLANS[d.plan];
  if (!unit) throw new Error(`Unknown plan "${d.plan}"`);
  const seats = Number(d.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 1000) throw new Error("Seats must be 1-1000");
  const { off } = VOLUME.find((t) => seats >= t.min);
  let amount = Math.round(unit * seats * (1 - off));
  if (d.onboarding === true || d.onboarding === "yes") amount += ADDONS.onboarding;
  return { amount, currency: "usd", description: `${d.plan} × ${seats}${off ? ` (${off * 100}% off)` : ""}` };
}

export default {
  async price({ data }) {
    return quote(data);
  },
  // The server already rejects a payment that doesn't match price() for the submitted answers (402 payment_mismatch).
  async beforeSubmit({ submission }) {
    return { computed: { plan: submission.data.plan, seats: Number(submission.data.seats), paid: submission.payment.amount } };
  },
};
```

Test: `test_hook { formId, event: "price", input: { data: { plan: "pro", seats: 12 } } }` →
`{ amount: 52920, currency: "usd", ... }`.
