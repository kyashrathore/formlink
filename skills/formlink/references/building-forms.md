# Building form UIs

Everything here is browser code. It talks only to the public API through `@formlink/sdk`
(`createForm`), which needs no key. Server-side rules live in the hook (`hooks.md`).

Contents: 1. Typeform-style single file · 2. Tally-style page · 3. Embedding · 4. Turnstile ·
5. Email/SMS OTP · 6. Stripe payments · 7. Hidden fields and UTM · 8. Accessibility checklist

Form settings this file assumes (set with `update_form`):

```json
{ "uploads": { "allowedTypes": ["application/pdf", "image/"] } }
```

`image/` is required for signatures (PNG). Empty `allowedTypes` allows any type; default max is 10MB.

---

## 1. Typeform-style: one question at a time (complete single file)

Features: questions as data, branching via `show(answers)`, Enter/letter-key navigation, progress
bar, `view`/`start`/`step` events, a draft per completed step, answers kept across reloads in
sessionStorage, file upload, signature pad, matrix question, server `fieldErrors` routed back to
the question, closed-form handling. Replace `FORM_ID` and the `QUESTIONS` list.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Apply</title>
<style>
  :root { --bg:#fff; --fg:#151515; --muted:#666; --accent:#2b59ff; --line:#d8d8d8; --err:#b00020; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111; --fg:#eee; --muted:#aaa; --accent:#7c9bff; --line:#333; --err:#ff6b81; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:18px/1.5 system-ui, sans-serif; }
  #progress { position:fixed; inset:0 0 auto; height:4px; background:var(--line); }
  #bar { height:100%; width:0; background:var(--accent); transition:width .3s; }
  main { max-width:640px; margin:0 auto; padding:18vh 16px 48px; }
  h1 { font-size:1.6rem; margin:0 0 1rem; outline:none; }
  .num { color:var(--accent); margin:0; font-size:.9rem; }
  input[type=text], input[type=email], input[type=number], textarea {
    width:100%; font:inherit; color:inherit; background:transparent; border:0; border-bottom:2px solid var(--line); padding:.4rem 0; }
  input:focus, textarea:focus { outline:none; border-color:var(--accent); }
  .opt { display:flex; gap:.6rem; align-items:center; width:100%; margin:.4rem 0; padding:.6rem .8rem; font:inherit; color:inherit;
    text-align:left; background:transparent; border:1px solid var(--line); border-radius:8px; cursor:pointer; }
  .opt[aria-pressed=true] { border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent); }
  .opt kbd, .nav kbd { font-size:.75rem; border:1px solid var(--line); border-radius:4px; padding:0 .35rem; }
  table { border-collapse:collapse; width:100%; } th, td { padding:.4rem; text-align:center; } th[scope=row] { text-align:left; font-weight:500; }
  canvas.sig { width:100%; height:auto; border:1px solid var(--line); border-radius:8px; background:#fff; touch-action:none; }
  .nav { display:flex; gap:.75rem; margin-top:1.5rem; }
  .nav button, .link { font:inherit; padding:.5rem 1rem; border-radius:8px; border:1px solid var(--line); background:transparent; color:inherit; cursor:pointer; }
  #next { background:var(--accent); border-color:var(--accent); color:#fff; }
  button:focus-visible, .opt:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .err { color:var(--err); min-height:1.5em; } .hint { color:var(--muted); font-size:.9rem; }
  @media (prefers-reduced-motion: reduce) { #bar { transition:none; } }
</style>
</head>
<body>
<div id="progress" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="bar"></div></div>
<main id="app"><p>Loading…</p></main>
<script type="module">
import { createForm, FormlinkError } from "https://esm.sh/@formlink/sdk";

const FORM_ID = "frm_REPLACE_ME";
const form = createForm({ formId: FORM_ID }); // hosted on Formlink: same origin, no baseUrl
const STORE_KEY = `answers:${FORM_ID}:${form.sessionId}`;

// Keys here are the submission data keys. `show` is the branching rule: a plain function of answers.
const QUESTIONS = [
  { id: "name", type: "text", title: "What's your name?", required: true },
  { id: "email", type: "email", title: "Where can we reach you?", required: true },
  { id: "role", type: "choice", title: "What describes you best?", required: true,
    options: ["Founder", "Engineer", "Designer", "Other"] },
  { id: "role_other", type: "text", title: "What's your role?", required: true, show: (a) => a.role === "Other" },
  { id: "team_size", type: "number", title: "How many people on your team?", show: (a) => a.role === "Founder" },
  { id: "ratings", type: "matrix", title: "How do we do on…", required: true,
    rows: ["Speed", "Docs", "Support"], columns: ["1", "2", "3", "4", "5"] },
  { id: "about", type: "long", title: "Anything else? (Shift+Enter for a new line)" },
  { id: "cv", type: "file", title: "Upload your CV (PDF)", accept: "application/pdf" },
  { id: "signature", type: "signature", title: "Sign to confirm the above is true", required: true },
];

const app = document.getElementById("app");
const progress = document.getElementById("progress");
const bar = document.getElementById("bar");
const seenSteps = new Set();
const fieldErrors = {};
let answers = loadAnswers();
let currentId = null;
let started = false;
let info;

function loadAnswers() { try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) ?? {}; } catch { return {}; } }
function persist() { sessionStorage.setItem(STORE_KEY, JSON.stringify(answers)); }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const visible = () => QUESTIONS.filter((q) => !q.show || q.show(answers));
// Only answers to questions on the current path are drafted/submitted.
const pathAnswers = () => Object.fromEntries(visible().filter((q) => answers[q.id] !== undefined).map((q) => [q.id, answers[q.id]]));
const errorText = (e) => e instanceof FormlinkError
  ? (e.fieldErrors ? Object.values(e.fieldErrors).join(" ") : e.message)
  : "Something went wrong. Check your connection and try again.";
function showError(msg) { const el = document.getElementById("err"); if (el) el.textContent = msg ?? ""; }
function setProgress(fraction) {
  bar.style.width = `${fraction * 100}%`;
  progress.setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
}

const textField = (inputType) => ({
  render(el, q) {
    el.innerHTML = q.type === "long"
      ? `<textarea rows="4" aria-labelledby="q-title" aria-describedby="err"></textarea>`
      : `<input type="${inputType}" aria-labelledby="q-title" aria-describedby="err"
           ${q.type === "email" ? 'autocomplete="email"' : q.id === "name" ? 'autocomplete="name"' : ""}>`;
    const input = el.querySelector("input, textarea");
    input.value = answers[q.id] ?? "";
    input.focus();
  },
  read(el, q) {
    const v = el.querySelector("input, textarea").value.trim();
    if (q.type === "number") return v === "" ? undefined : Number(v);
    return v === "" ? undefined : v;
  },
});

const FIELDS = {
  text: textField("text"),
  email: textField("email"),
  number: textField("number"),
  long: textField("text"),
  choice: {
    render(el, q) {
      el.innerHTML = `<div role="group" aria-labelledby="q-title">${q.options.map((o, i) =>
        `<button type="button" class="opt" data-value="${esc(o)}" aria-pressed="${answers[q.id] === o}">
           <kbd>${String.fromCharCode(65 + i)}</kbd>${esc(o)}</button>`).join("")}</div>`;
      el.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
        el.querySelectorAll(".opt").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        el.dataset.value = b.dataset.value;
        next();
      }));
      if (answers[q.id] !== undefined) el.dataset.value = answers[q.id];
      el.querySelector(".opt").focus();
    },
    read: (el) => el.dataset.value,
  },
  matrix: {
    render(el, q) {
      const cur = answers[q.id] ?? {};
      el.innerHTML = `<table><thead><tr><td></td>${q.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${
        q.rows.map((r, ri) => `<tr><th scope="row" id="${q.id}-r${ri}">${esc(r)}</th>${q.columns.map((c) =>
          `<td><input type="radio" name="${q.id}-r${ri}" value="${esc(c)}"
             aria-label="${esc(r)}: ${esc(c)}" ${cur[r] === c ? "checked" : ""}></td>`).join("")}</tr>`).join("")
      }</tbody></table>`;
      el.querySelector("input").focus();
    },
    read(el, q) {
      const out = {};
      q.rows.forEach((r, ri) => { const c = el.querySelector(`input[name="${q.id}-r${ri}"]:checked`); if (c) out[r] = c.value; });
      return Object.keys(out).length ? out : undefined;
    },
  },
  file: {
    render(el, q) {
      const mb = Math.floor(info.uploads.maxBytes / 1048576);
      el.innerHTML = `<input type="file" accept="${esc(q.accept ?? "")}" aria-labelledby="q-title" aria-describedby="file-status err">
        <p class="hint" id="file-status" aria-live="polite">${answers[q.id] ? `Uploaded: ${esc(answers[q.id].name)}` : `Up to ${mb} MB`}</p>`;
      const status = el.querySelector("#file-status");
      el.querySelector("input").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > info.uploads.maxBytes) return showError(`Files are limited to ${mb} MB.`);
        status.textContent = "Uploading…";
        showError("");
        // read() awaits this, so pressing OK mid-upload waits instead of losing the file.
        el.pending = form.upload(file).then(
          (meta) => { answers[q.id] = meta; persist(); status.textContent = `Uploaded: ${meta.name}`; },
          (err) => { status.textContent = ""; showError(errorText(err)); },
        );
      });
    },
    async read(el, q) { await el.pending; return answers[q.id]; }, // { id, name, type, size }
  },
  signature: {
    render(el, q) {
      el.innerHTML = `<canvas class="sig" width="600" height="200" role="img"
          aria-label="Signature pad. Draw with a mouse, finger or pen."></canvas>
        <p class="hint">${answers[q.id] ? "Signed. Draw again to replace it." : "Draw your signature above."}
          <button type="button" class="link" id="clear">Clear</button></p>`;
      const c = el.querySelector("canvas");
      const g = c.getContext("2d");
      const blank = () => { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); };
      blank();
      g.lineWidth = 2.5; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#111";
      const at = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
      let drawing = false;
      c.addEventListener("pointerdown", (e) => { drawing = true; el.dirty = true; c.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...at(e)); });
      c.addEventListener("pointermove", (e) => { if (drawing) { g.lineTo(...at(e)); g.stroke(); } });
      c.addEventListener("pointerup", () => { drawing = false; });
      el.querySelector("#clear").addEventListener("click", () => { blank(); el.dirty = false; delete answers[q.id]; persist(); });
    },
    async read(el, q) {
      if (!el.dirty) return answers[q.id];
      const blob = await new Promise((resolve) => el.querySelector("canvas").toBlob(resolve, "image/png"));
      return form.upload(new File([blob], "signature.png", { type: "image/png" })); // stored as a file, id in data
    },
  },
};

function validate(q, v) {
  if (q.required && v === undefined)
    return q.type === "matrix" ? "Please answer every row." : q.type === "signature" ? "Please sign." : "This one is required.";
  if (q.required && q.type === "matrix" && Object.keys(v).length < q.rows.length) return "Please answer every row.";
  if (q.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "That email doesn't look right.";
  if (q.type === "number" && v !== undefined && !Number.isFinite(v)) return "Please enter a number.";
}

function render() {
  const qs = visible();
  let i = qs.findIndex((q) => q.id === currentId);
  if (i < 0) { i = 0; currentId = qs[0].id; }
  const q = qs[i];
  setProgress(i / qs.length);
  app.innerHTML = `
    <section aria-labelledby="q-title">
      <p class="num">Question ${i + 1} of ${qs.length}</p>
      <h1 id="q-title" tabindex="-1">${esc(q.title)}${q.required ? ' <span aria-hidden="true">*</span>' : ""}</h1>
      <div id="field"></div>
      <p id="err" class="err" role="alert"></p>
      <div class="nav">
        ${i > 0 ? '<button type="button" id="back">Back</button>' : ""}
        <button type="button" id="next">${i === qs.length - 1 ? "Submit" : "OK"} <kbd>Enter ↵</kbd></button>
      </div>
    </section>`;
  FIELDS[q.type].render(app.querySelector("#field"), q);
  if (!["text", "email", "number", "long", "choice", "matrix"].includes(q.type)) app.querySelector("h1").focus();
  app.querySelector("#next").addEventListener("click", next);
  app.querySelector("#back")?.addEventListener("click", () => { currentId = qs[i - 1].id; render(); });
  showError(fieldErrors[q.id]);
  if (!seenSteps.has(q.id)) { seenSteps.add(q.id); form.track("step", q.id); } // funnel: who reached which question
}

async function next() {
  const q = visible().find((x) => x.id === currentId);
  const btn = document.getElementById("next");
  if (!btn || btn.disabled) return; // Enter pressed while busy
  btn.disabled = true;
  try {
    const value = await FIELDS[q.type].read(app.querySelector("#field"), q);
    const problem = validate(q, value);
    if (problem) return showError(problem);
    if (value === undefined) delete answers[q.id]; else answers[q.id] = value;
    delete fieldErrors[q.id];
    persist();
    if (!started) { started = true; form.track("start"); }
    form.saveDraft(pathAnswers()).catch((e) => console.warn("draft not saved:", e.message));
    const qs = visible(); // the answer may have changed the path
    const j = qs.findIndex((x) => x.id === q.id);
    if (j === qs.length - 1) return submit();
    currentId = qs[j + 1].id;
    render();
  } catch (e) {
    showError(errorText(e));
  } finally {
    if (btn.isConnected) btn.disabled = false;
  }
}

async function submit() {
  app.innerHTML = `<p role="status">Submitting…</p>`;
  try {
    const res = await form.submit(pathAnswers());
    done(res);
  } catch (e) {
    if (e instanceof FormlinkError && e.code === "already_submitted") return done(null);
    if (e instanceof FormlinkError && e.fieldErrors) {
      Object.assign(fieldErrors, e.fieldErrors);
      const first = visible().find((q) => fieldErrors[q.id]);
      if (first) { currentId = first.id; return render(); }
    }
    render();
    showError(errorText(e));
  }
}

function done(res) {
  sessionStorage.removeItem(STORE_KEY);
  setProgress(1);
  // `computed` comes from beforeSubmit (e.g. a quiz score). Never compute it here.
  const score = res?.computed?.score;
  app.innerHTML = `<section><h1 tabindex="-1">Thanks, we got it.</h1>
    ${score !== undefined ? `<p>Your score: <strong>${esc(score)}</strong></p>` : ""}</section>`;
  app.querySelector("h1").focus();
}

document.addEventListener("keydown", (e) => {
  if (!document.getElementById("next")) return;
  const t = e.target;
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    if (t.tagName === "BUTTON") return; // native click already fires
    if (t.tagName === "TEXTAREA" && !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    next();
    return;
  }
  // A, B, C… pick a choice when focus isn't in a text field.
  if (/^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey && !["INPUT", "TEXTAREA"].includes(t.tagName))
    app.querySelectorAll(".opt")[e.key.toUpperCase().charCodeAt(0) - 65]?.click();
});

try {
  info = await form.info();
  if (!info.open) app.innerHTML = `<h1>This form is closed.</h1>`;
  else { form.track("view"); render(); }
} catch (e) {
  app.innerHTML = `<h1>Couldn't load this form.</h1><p>${esc(errorText(e))}</p>`;
}
</script>
</body>
</html>
```

Notes on the pattern:

- **Branching**: add `show: (a) => ...` to any question. Back/next always walk `visible()`, so changing an
  earlier answer reroutes the path. Answers to hidden questions are kept locally (in case the user
  goes back) but never drafted or submitted.
- **Events**: `view` once per load, `start` on the first completed question, `step` the first time
  each question is shown. `get_analytics` then reports reach and drop-off per question id. The
  server records `complete` itself on submit.
- **Drafts**: one `saveDraft` per completed step. Drafts appear in `query_submissions` with
  `drafts: true` or `status: "draft"`; submitting the same session turns the draft into the
  submission (same id). Server drafts are write-only from the browser, so local resume uses sessionStorage.
- **Uploads** attach to this session's submission automatically on submit. Put the returned
  `{ id, name, type, size }` in `data` so you know which question a file answers. Hooks and
  `get_submission` see `files[]` with signed download URLs (valid 7 days, re-fetch for fresh ones).
- **Field errors**: `beforeSubmit` returning `{ errors: { email: "..." } }` → `FormlinkError` with
  `fieldErrors.email`. The code jumps to that question. Keys must equal question ids.
- **Welcome screen**: render a heading + "Start" button before the first question; call
  `form.track("start")` on that click instead.
- **Submit another**: after `done`, offer a button that calls `form.reset()`, clears `answers`, and re-renders.

---

## 2. Tally-style: one document page

Same SDK wiring; differences only. Use a native `<form>`, show/hide conditional blocks, draft on
`change` (debounced), one `step` event per section as it scrolls into view.

```html
<form id="f" novalidate>
  <section data-step="contact">
    <h2>Contact</h2>
    <label>Name <input name="name" required autocomplete="name"></label><p class="err" data-err="name"></p>
    <label>Email <input name="email" type="email" required autocomplete="email"></label><p class="err" data-err="email"></p>
  </section>
  <section data-step="project">
    <fieldset><legend>Budget</legend>
      <label><input type="radio" name="budget" value="small"> Under $5k</label>
      <label><input type="radio" name="budget" value="large"> $5k+</label>
    </fieldset><p class="err" data-err="budget"></p>
    <div data-show-if="budget=large" hidden>
      <label>Procurement contact <input name="procurement_email" type="email"></label><p class="err" data-err="procurement_email"></p>
    </div>
  </section>
  <p class="err" id="form-err" role="alert"></p>
  <button type="submit">Submit</button>
</form>
<script type="module">
import { createForm, FormlinkError } from "https://esm.sh/@formlink/sdk";
const form = createForm({ formId: "frm_REPLACE_ME" });
const el = document.getElementById("f");

function collect() {
  const data = {};
  for (const input of el.elements) {
    if (!input.name || input.closest("[hidden]")) continue; // hidden branch: not submitted
    if ((input.type === "radio" || input.type === "checkbox") && !input.checked) continue;
    if (input.value.trim() === "") continue;
    data[input.name] = input.type === "checkbox" ? [...(data[input.name] ?? []), input.value] : input.value.trim();
  }
  return data;
}
function applyBranching() {
  const data = collect();
  for (const block of el.querySelectorAll("[data-show-if]")) {
    const [key, value] = block.dataset.showIf.split("=");
    block.hidden = data[key] !== value;
  }
}
function showErrors(errors = {}) {
  for (const p of el.querySelectorAll("[data-err]")) {
    p.textContent = errors[p.dataset.err] ?? "";
    el.elements[p.dataset.err]?.setAttribute?.("aria-invalid", String(!!errors[p.dataset.err]));
  }
  const first = Object.keys(errors)[0];
  if (first) (el.elements[first]?.focus ? el.elements[first] : el.elements[first]?.[0])?.focus();
}

let started = false, draftTimer;
el.addEventListener("change", () => {
  applyBranching();
  if (!started) { started = true; form.track("start"); }
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => form.saveDraft(collect()).catch(() => {}), 1500); // stays under the rate limit
});
const seen = new Set();
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  const step = e.target.dataset.step;
  if (e.isIntersecting && !seen.has(step)) { seen.add(step); form.track("step", step); }
}), { threshold: 0.5 });
el.querySelectorAll("[data-step]").forEach((s) => io.observe(s));

el.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const data = collect();
  const local = {};
  if (!data.name) local.name = "Required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email ?? "")) local.email = "Enter a valid email";
  showErrors(local);
  if (Object.keys(local).length) return;
  const btn = el.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await form.submit(data);
    el.outerHTML = `<h2 tabindex="-1" id="thanks">Thanks!</h2>`;
    document.getElementById("thanks").focus();
  } catch (e) {
    if (e instanceof FormlinkError && e.code === "already_submitted") return void (el.outerHTML = "<h2>Thanks!</h2>");
    if (e instanceof FormlinkError && e.fieldErrors) showErrors(e.fieldErrors);
    document.getElementById("form-err").textContent = e.message;
    btn.disabled = false;
  }
});

const info = await form.info();
if (!info.open) el.outerHTML = "<p>This form is closed.</p>"; else form.track("view");
</script>
```

Multi-page Tally variant: wrap each page in `<section data-step>` with only one visible at a time,
validate the page before "Next", and call `form.saveDraft(collect())` on each page change.

---

## 3. Embedding in an existing site

**Option A — iframe a Formlink-hosted form (no origin config):**

```html
<iframe src="https://<site-url>/" title="Apply" style="width:100%;border:0;height:640px" loading="lazy"></iframe>
```

Auto-height: in the form page, `new ResizeObserver(() => parent.postMessage({ formlinkHeight:
document.documentElement.scrollHeight }, "*")).observe(document.body)`; in the host page, listen for
`message`, check `event.origin` equals the site origin, and set the iframe height.

**Option B — render inline in the host page (their DOM, their CSS):**

```js
const form = createForm({ formId: "frm_...", baseUrl: "https://<api-host>" }); // not same origin: set baseUrl
```

Then lock the form to that site: `update_form { formId, settings: { allowedOrigins: ["https://www.example.com", "https://example.com"] } }`.
Origins are exact strings (scheme + host + port, no trailing slash). Requests from other origins get
403 `forbidden`. Include every origin that serves the page (www and apex, staging, and the Formlink
site origin if the form is also hosted there). This is a browser guard, not authentication; use
Turnstile against bots. CORS is already open for `/v1/*`.

---

## 4. Turnstile (bot protection)

Setup: create a Turnstile widget in the Cloudflare dashboard for the page's hostname; then
`set_secret TURNSTILE_SECRET_KEY` and `update_form { settings: { turnstile: true } }`.
The site key is public and goes in the page.

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<div class="cf-turnstile" data-sitekey="0x4AAAAAAA..." data-callback="onTurnstile" data-expired-callback="onTurnstileExpired"></div>
<script>
  window.turnstileToken = null;
  function onTurnstile(t) { window.turnstileToken = t; }
  function onTurnstileExpired() { window.turnstileToken = null; }
</script>
```

```js
async function submitWithTurnstile(data) {
  if (info.turnstile && !window.turnstileToken) throw new Error("Please complete the check above.");
  try {
    return await form.submit(data, { turnstileToken: window.turnstileToken });
  } catch (e) {
    window.turnstile?.reset(); window.turnstileToken = null; // tokens are single-use
    throw e;
  }
}
```

Errors: 400 `bad_request` (token missing), 403 `turnstile_failed`, 501 `not_configured` (secret missing).
In a one-question-at-a-time form, render the widget on the last step only.

---

## 5. Email / SMS verification (OTP)

Setup: a `sendVerification` hook that delivers the code (`hooks.md`), then
`update_form { settings: { verification: "email" } }` (or `"sms"`). Submissions without a valid
token for that channel get 403 `verification_required`.

```js
let verificationId, verificationToken;

async function sendCode(email) {               // step: "What's your email?"
  ({ id: verificationId } = await form.verify.start("email", email)); // phone: form.verify.start("sms", "+14155550100")
}
async function checkCode(code) {               // step: "Enter the 6-digit code we sent"
  ({ token: verificationToken } = await form.verify.check(verificationId, code));
}
await form.submit(data, { verificationToken });
```

Code input: `<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6">`.
Offer "Resend code" (calls `verify.start` again) and "Change email".

| Situation | Error |
|---|---|
| Bad email / phone not E.164 (`+14155550100`) | 400 `bad_request` |
| More than 5 codes to the same target in 10 min | 429 `rate_limited` |
| No `sendVerification` hook | 501 `not_configured` |
| Hook threw | 502 `delivery_failed` |
| Wrong code | 400 `bad_request` "Incorrect code" |
| Code expired (10 min) or unknown id | 404 `not_found` |
| 5 wrong attempts | 429 `rate_limited` → request a new code |

The token is valid for 1 hour. The server stores `verified: { channel, target }` on the submission
but does not compare it to your `data`; enforce `data.email === submission.verified.target` in
`beforeSubmit` (see `hooks.md`).

---

## 6. Stripe payments (Elements)

Setup: `set_secret STRIPE_SECRET_KEY`, a `price` hook (`hooks.md`), `update_form { settings: { payment: true } }`.
The publishable key (`pk_...`) goes in the page. The browser never sends an amount.

```html
<script src="https://js.stripe.com/v3/"></script>
<div id="price"></div><div id="payment-element"></div><p id="pay-err" role="alert"></p>
<button id="pay" type="button">Pay and submit</button>
```

```js
const stripe = Stripe("pk_live_or_test_...");
let elements;

// Call when the user reaches the payment step (and again if a price-affecting answer changes).
async function preparePayment(answers) {
  const { clientSecret, amount, currency } = await form.createPayment(answers); // runs the price hook
  document.getElementById("price").textContent =
    new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  elements = stripe.elements({ clientSecret });
  elements.create("payment").mount("#payment-element");
}

document.getElementById("pay").addEventListener("click", async () => {
  const btn = document.getElementById("pay");
  btn.disabled = true;
  sessionStorage.setItem("pending-answers", JSON.stringify(answers)); // survives a redirect-based method
  const { error, paymentIntent } = await stripe.confirmPayment({
    elements, redirect: "if_required", confirmParams: { return_url: location.href },
  });
  if (error) { document.getElementById("pay-err").textContent = error.message; btn.disabled = false; return; }
  await finish(paymentIntent.id);
});

async function finish(paymentIntentId) {
  const data = JSON.parse(sessionStorage.getItem("pending-answers"));
  try {
    const res = await form.submit(data, { paymentIntentId });
    sessionStorage.removeItem("pending-answers");
    showThanks(res); // your thank-you screen
  } catch (e) {
    // Paid but rejected (e.g. beforeSubmit errors): a PaymentIntent is consumed only by a stored submission,
    // so let the user fix answers and call form.submit again with the same paymentIntentId.
    document.getElementById("pay-err").textContent = e.message;
  }
}

// Returning from a redirect (3DS / wallets): Stripe appends these params.
const params = new URLSearchParams(location.search);
if (params.get("payment_intent") && params.get("redirect_status") === "succeeded") await finish(params.get("payment_intent"));
```

Put the payment step last, after all client-side validation, so money is taken only for answers
that will pass `beforeSubmit`. Server checks on submit: PaymentIntent belongs to this form **and session** (keep the same tab —
the SDK keeps `sessionId` in sessionStorage), status is `succeeded` (anything else → 402
`payment_required`), and it was not used before (409 `conflict`). Async methods that stay
`processing` will be rejected; restrict methods in the Stripe dashboard if that matters.
`amount / 100` is wrong for zero-decimal currencies (JPY, KRW): format with the currency's minor unit.
Bank debits and other delayed methods: submit while the PaymentIntent is `processing`; the result's `status` is `"pending_payment"`, so tell the respondent the payment is being confirmed. Stripe's webhook settles it (see api.md, Stripe webhook).
`createPayment` errors: 400 (form has `payment: false`), 501 `not_configured` (no price hook or no
Stripe key), 502 `hook_failed` (bad price result), 502 `stripe_error`.

---

## 7. Hidden fields and UTM

The SDK adds `form.context()` (query params such as `utm_source`, `utm_campaign`, `ref`, plus `$url`
and `$referrer`) to `meta` on every `submit` and `saveDraft`. The server adds `$origin`, `$referer`,
`$userAgent`, `$country`. So `https://site/?utm_source=x&ref=abc` needs no code to be captured.

Put a value in `data` (so it appears as a CSV column and in hooks' `submission.data`) when it
drives logic or must be filterable with `q`:

```js
const params = new URLSearchParams(location.search);
await form.submit({ ...answers, ref: params.get("ref") ?? undefined, plan: params.get("plan") ?? "free" }, {
  meta: { variant: "pricing-b" }, // extra meta; merged with context
});
```

Prefill: read params on load into `answers` (e.g. `?email=` prefills the email question). Never
trust hidden fields for anything that matters (price, eligibility): recompute in the hook.
`meta` is capped at 16KB.

---

## 8. Accessibility checklist

- One `<h1>` per question screen; label inputs via `<label>` or `aria-labelledby` pointing at it.
- Move focus on every screen change: to the input, the first option, or the heading (`tabindex="-1"`).
- Errors in an element with `role="alert"`; link with `aria-describedby`; set `aria-invalid` on the field.
- Choices as real `<button aria-pressed>` or radio inputs; never clickable `<div>`s. Group with `role="group"`/`<fieldset>`.
- Matrix: a real `<table>` with `<th scope="col">` / `<th scope="row">`, one radio group per row.
- Signature: offer an alternative where legally acceptable (typed full name + checkbox) for users who can't draw.
- Progress: `role="progressbar"` with `aria-valuenow`, plus visible "Question n of m" text.
- Keyboard: everything reachable with Tab; Enter advances; Shift+Enter for newlines; visible focus ring.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`; keep 4.5:1 contrast; tap targets ≥ 44px.
- `autocomplete` on name/email/tel/address fields; `inputmode` for numeric input.
- Don't rely on color alone for selected/error states.
