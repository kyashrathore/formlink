// End-to-end check against a running worker: `pnpm dev` in one shell, `pnpm test:e2e` in another.
// Exercises the full flow an AI-built app goes through. Exits non-zero on the first failure.
import assert from "node:assert/strict";

const BASE = process.env.FORMLINK_URL ?? "http://localhost:8787";
let KEY = "";

async function call(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: {
      ...(KEY ? { authorization: `Bearer ${KEY}` } : {}),
      ...(body !== undefined && !(body instanceof Uint8Array) ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}\n`, err);
    process.exit(1);
  }
};

const session = () => `s_${crypto.randomUUID()}`;
let formId, siteId, privateSite;

await step("create workspace", async () => {
  const r = await call("POST", "/v1/workspaces", { name: "e2e" });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  KEY = r.json.key.secret;
  assert.match(KEY, /^fl_sk_/);
});

await step("reject bad key", async () => {
  const saved = KEY;
  KEY = "fl_sk_nope";
  const r = await call("GET", "/v1/forms");
  KEY = saved;
  assert.equal(r.status, 401);
});

await step("create form", async () => {
  const r = await call("POST", "/v1/forms", { name: "Lead form", settings: { retentionDays: 30 } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  formId = r.json.id;
  assert.equal(r.json.settings.uploads.maxBytes, 10 * 1024 * 1024);
  // A patch keeps settings it doesn't mention.
  const p = await call("PATCH", `/v1/forms/${formId}`, { settings: { uploads: { allowedTypes: ["text/"] } } });
  assert.equal(p.json.settings.retentionDays, 30);
  assert.equal(p.json.settings.uploads.maxBytes, 10 * 1024 * 1024);
});

const HOOK = `
export default {
  async beforeSubmit({ submission }) {
    if (!submission.data.email) return { errors: { email: "Email is required" } };
    if (submission.data.email === "boom@x.io") throw new Error("Blocked domain");
    return { computed: { score: (submission.data.budget ?? 0) > 1000 ? 10 : 1 } };
  },
  async afterSubmit({ submission }, ctx) {
    console.log("after", submission.id, ctx.secrets.GREETING);
    return { computed: { notified: true } };
  },
  async onStatusChange({ submission, previousStatus }) {
    return { computed: { approvedFrom: previousStatus } };
  },
  async sendVerification({ channel, to, code }) {
    console.log("CODE", code);
  },
};`;

await step("set secret and hook", async () => {
  assert.equal((await call("PUT", "/v1/secrets/GREETING", { value: "hello" })).status, 204);
  const bad = await call("PUT", `/v1/forms/${formId}/hook`, { code: "export default { oops(" });
  assert.equal(bad.status, 400, JSON.stringify(bad.json));
  const r = await call("PUT", `/v1/forms/${formId}/hook`, { code: HOOK });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.version, 1);
  assert.ok(r.json.exports.includes("beforeSubmit"));
});

await step("test hook without storing", async () => {
  const r = await call("POST", `/v1/forms/${formId}/hook/test`, {
    event: "beforeSubmit",
    input: { submission: { data: { email: "a@b.co", budget: 5000 } } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.result, { computed: { score: 10 } });
});

await step("public form info", async () => {
  const r = await call("GET", `/v1/f/${formId}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.open, true);
});

const sid = session();
await step("draft, upload and events", async () => {
  assert.equal((await call("PUT", `/v1/f/${formId}/drafts/${sid}`, { data: { name: "Ada" } })).status, 200);
  const up = await call("POST", `/v1/f/${formId}/uploads?sessionId=${sid}&name=cv.txt`, new TextEncoder().encode("hello file"), {
    "content-type": "text/plain",
  });
  assert.equal(up.status, 201, JSON.stringify(up.json));
  const ev = await call("POST", `/v1/f/${formId}/events`, {
    sessionId: sid,
    events: [{ type: "view" }, { type: "start" }, { type: "step", step: "email" }],
  });
  assert.equal(ev.status, 204);
});

await step("hook rejects invalid submission", async () => {
  const r = await call("POST", `/v1/f/${formId}/submissions`, { sessionId: sid, data: { name: "Ada" } });
  assert.equal(r.status, 422);
  assert.equal(r.json.error.details.errors.email, "Email is required");
  const thrown = await call("POST", `/v1/f/${formId}/submissions`, { data: { email: "boom@x.io" } });
  assert.equal(thrown.status, 422);
  assert.equal(thrown.json.error.message, "Blocked domain");
});

let subId;
await step("submit completes the draft", async () => {
  const r = await call("POST", `/v1/f/${formId}/submissions`, {
    sessionId: sid,
    data: { name: "Ada", email: "ada@example.com", budget: 5000 },
    meta: { utm_source: "x" },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.computed.score, 10);
  subId = r.json.id;
  const again = await call("POST", `/v1/f/${formId}/submissions`, { sessionId: sid, data: { email: "a@b.co" } });
  assert.equal(again.status, 409);
});

await step("afterSubmit ran with secrets and files attached", async () => {
  let s;
  for (let i = 0; i < 20; i++) {
    s = (await call("GET", `/v1/submissions/${subId}`)).json;
    if (s.computed.notified) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(s.computed.notified, true);
  assert.equal(s.files.length, 1);
  const file = await fetch(s.files[0].url);
  assert.equal(await file.text(), "hello file");
  const runs = (await call("GET", `/v1/forms/${formId}/hook/runs`)).json.runs;
  assert.ok(runs.some((r) => r.event === "afterSubmit" && r.logs.some((l) => l.includes("hello"))));
});

await step("list, filter and export", async () => {
  const list = await call("GET", `/v1/forms/${formId}/submissions?q=ada`);
  assert.equal(list.json.submissions.length, 1);
  const csv = await call("GET", `/v1/forms/${formId}/export?format=csv`);
  assert.match(csv.json, /email/);
  assert.match(csv.json, /ada@example.com/);
});

await step("status change runs onStatusChange", async () => {
  const r = await call("PATCH", `/v1/submissions/${subId}`, { status: "approved" });
  assert.equal(r.json.status, "approved");
  let s;
  for (let i = 0; i < 20; i++) {
    s = (await call("GET", `/v1/submissions/${subId}`)).json;
    if (s.computed.approvedFrom) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(s.computed.approvedFrom, "complete");
});

await step("analytics funnel", async () => {
  const a = (await call("GET", `/v1/forms/${formId}/analytics`)).json;
  assert.equal(a.views, 1);
  assert.equal(a.starts, 1);
  assert.equal(a.completes, 1);
  assert.equal(a.steps[0].step, "email");
});

await step("email verification required", async () => {
  await call("PATCH", `/v1/forms/${formId}`, { settings: { verification: "email" } });
  const blocked = await call("POST", `/v1/f/${formId}/submissions`, { data: { email: "v@x.io" } });
  assert.equal(blocked.status, 403);
  const start = await call("POST", `/v1/f/${formId}/verify`, { channel: "email", to: "V@x.io" });
  assert.equal(start.status, 201, JSON.stringify(start.json));
  const runs = (await call("GET", `/v1/forms/${formId}/hook/runs`)).json.runs;
  const code = runs.find((r) => r.event === "sendVerification").logs[0].split(" ").pop();
  const wrong = await call("POST", `/v1/f/${formId}/verify/check`, { id: start.json.id, code: "000000" === code ? "111111" : "000000" });
  assert.equal(wrong.status, 400);
  const ok = await call("POST", `/v1/f/${formId}/verify/check`, { id: start.json.id, code });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  const r = await call("POST", `/v1/f/${formId}/submissions`, {
    data: { email: "v@x.io" },
    verificationToken: ok.json.token,
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  await call("PATCH", `/v1/forms/${formId}`, { settings: { verification: null } });
});

await step("origin allowlist", async () => {
  await call("PATCH", `/v1/forms/${formId}`, { settings: { allowedOrigins: ["https://ok.example"] } });
  const r = await call("POST", `/v1/f/${formId}/submissions`, { data: { email: "o@x.io" } }, { origin: "https://evil.example" });
  assert.equal(r.status, 403);
  const ok = await call("POST", `/v1/f/${formId}/submissions`, { data: { email: "o@x.io" } }, { origin: "https://ok.example" });
  assert.equal(ok.status, 201);
  await call("PATCH", `/v1/forms/${formId}`, { settings: { allowedOrigins: null } });
});

await step("host a public site", async () => {
  const s = await call("POST", "/v1/sites", { name: "Lead page", slug: "lead-page-e2e" });
  assert.equal(s.status, 201, JSON.stringify(s.json));
  siteId = s.json.id;
  const d = await call("POST", `/v1/sites/${siteId}/deployments`, {
    files: {
      "index.html": { content: "<h1>Hi</h1>" },
      "app.js": { content: "console.log(1)" },
      "dot.png": { content: "iVBORw0KGgo=", encoding: "base64" },
    },
  });
  assert.equal(d.status, 201, JSON.stringify(d.json));
  const page = await fetch(`${BASE}/s/lead-page-e2e/`);
  assert.equal(await page.text(), "<h1>Hi</h1>");
  const js = await fetch(`${BASE}/s/lead-page-e2e/app.js`);
  assert.match(js.headers.get("content-type"), /javascript/);
  const spa = await fetch(`${BASE}/s/lead-page-e2e/some/route`);
  assert.equal(await spa.text(), "<h1>Hi</h1>");
  // Same-origin public API through the site path.
  const info = await fetch(`${BASE}/s/lead-page-e2e/v1/f/${formId}`);
  assert.equal((await info.json()).id, formId);
});

await step("private view reads submissions with its share link only", async () => {
  const s = await call("POST", "/v1/sites", { name: "Dashboard", slug: "dash-e2e", visibility: "private", dataForms: [formId] });
  privateSite = s.json;
  await call("POST", `/v1/sites/${privateSite.id}/deployments`, { files: { "index.html": { content: "secret dash" } } });
  const denied = await fetch(`${BASE}/s/dash-e2e/`);
  assert.equal(denied.status, 401);
  const share = await fetch(privateSite.shareUrl, { redirect: "manual" });
  assert.equal(share.status, 302);
  const cookie = share.headers.get("set-cookie").split(";")[0];
  const page = await fetch(`${BASE}/s/dash-e2e/`, { headers: { cookie } });
  assert.equal(await page.text(), "secret dash");
  const data = await fetch(`${BASE}/v1/forms/${formId}/submissions`, {
    headers: { cookie, "x-formlink-site": "dash-e2e", referer: `${BASE}/s/dash-e2e/` },
  });
  assert.equal(data.status, 200);
  // Another page on the same origin can't borrow the view's cookie.
  const borrowed = await fetch(`${BASE}/v1/forms/${formId}/submissions`, {
    headers: { cookie, "x-formlink-site": "dash-e2e", referer: `${BASE}/s/lead-page-e2e/` },
  });
  assert.equal(borrowed.status, 401);
  assert.ok((await data.json()).submissions.length >= 1);
  const write = await fetch(`${BASE}/v1/forms/${formId}`, {
    method: "PATCH",
    headers: { cookie, "x-formlink-site": "dash-e2e", referer: `${BASE}/s/dash-e2e/`, "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(write.status, 403);
});

await step("read-only key", async () => {
  const k = await call("POST", "/v1/keys", { name: "viewer", role: "read" });
  const saved = KEY;
  KEY = k.json.secret;
  assert.equal((await call("GET", "/v1/forms")).status, 200);
  assert.equal((await call("POST", "/v1/forms", { name: "x" })).status, 403);
  KEY = saved;
});

await step("MCP over API key", async () => {
  const init = await call("POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  assert.equal(init.json.result.serverInfo.name, "formlink");
  const list = await call("POST", "/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.ok(list.json.result.tools.some((t) => t.name === "deploy_site"));
  const forms = await call("POST", "/mcp", {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "query_submissions", arguments: { formId, limit: 5 } },
  });
  assert.ok(!forms.json.result.isError, JSON.stringify(forms.json));
  assert.ok(forms.json.result.structuredContent.submissions.length >= 1);
  const note = await call("POST", "/mcp", { jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(note.status, 202);
});

await step("MCP requires auth and advertises OAuth", async () => {
  const saved = KEY;
  KEY = "";
  const r = await call("POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" });
  KEY = saved;
  assert.equal(r.status, 401);
  const meta = await call("GET", "/.well-known/oauth-authorization-server");
  assert.equal(meta.status, 200);
  assert.ok(meta.json.authorization_endpoint.endsWith("/authorize"));
});

await step("OAuth: register, consent with a key, token, MCP call", async () => {
  const reg = await call("POST", "/register", { redirect_uris: ["https://client.example/cb"], client_name: "E2E Client", token_endpoint_auth_method: "none" });
  assert.equal(reg.status, 201, JSON.stringify(reg.json));
  const verifier = "v".repeat(64);
  const challenge = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url");
  const q = new URLSearchParams({
    response_type: "code",
    client_id: reg.json.client_id,
    redirect_uri: "https://client.example/cb",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "xyz",
    resource: `${BASE}/mcp`,
  });
  const page = await fetch(`${BASE}/authorize?${q}`);
  assert.match(await page.text(), /E2E Client/);
  const bad = await fetch(`${BASE}/authorize?${q}`, { method: "POST", body: new URLSearchParams({ key: "fl_sk_wrong" }) });
  assert.equal(bad.status, 401);
  const ok = await fetch(`${BASE}/authorize?${q}`, { method: "POST", body: new URLSearchParams({ key: KEY }), redirect: "manual" });
  assert.equal(ok.status, 302);
  const code = new URL(ok.headers.get("location")).searchParams.get("code");
  const tok = await fetch(`${BASE}/token`, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: "https://client.example/cb", client_id: reg.json.client_id, code_verifier: verifier, resource: `${BASE}/mcp` }),
  });
  const token = await tok.json();
  assert.ok(token.access_token, JSON.stringify(token));
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "whoami", arguments: {} } }),
  });
  const out = await res.json();
  assert.equal(out.result.structuredContent.role, "admin", JSON.stringify(out));
});

await step("delete form cleans up", async () => {
  assert.equal((await call("DELETE", `/v1/forms/${formId}`)).status, 204);
  assert.equal((await call("GET", `/v1/forms/${formId}`)).status, 404);
  await call("DELETE", `/v1/sites/${siteId}`);
  await call("DELETE", `/v1/sites/${privateSite.id}`);
});

console.log("\nall e2e checks passed");
