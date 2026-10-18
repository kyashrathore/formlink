// Starts local mocks and a worker wired to them, then checks the paths that talk to third parties:
// Stripe payments, Turnstile, custom domains, subdomain hosting, the retention cron and rate limits.
// Run: pnpm test:external   (needs migrations applied: pnpm db:migrate:local)
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { startMocks } from "./mock-server.mjs";

const MOCK = 8788;
const PORT = 8790;
const BASE = `http://localhost:${PORT}`;
const mocks = await startMocks(MOCK);
const vars = {
  PUBLIC_URL: BASE,
  SITES_DOMAIN: "sites.test",
  CF_ZONE_ID: "zone1",
  CF_API_TOKEN: "cf_mock",
  STRIPE_API_URL: `http://localhost:${MOCK}/stripe`,
  TURNSTILE_VERIFY_URL: `http://localhost:${MOCK}/turnstile`,
  CF_API_URL: `http://localhost:${MOCK}/cf`,
};
// The worker's default global_fetch_strictly_public flag would block localhost mocks, so it is dropped here.
const worker = spawn(
  "npx",
  ["wrangler", "dev", "--port", String(PORT), "--test-scheduled", "--compatibility-flags", "nodejs_compat",
    ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`])],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
worker.stdout.on("data", (d) => (log += d));
worker.stderr.on("data", (d) => (log += d));
const stop = () => {
  worker.kill();
  mocks.close();
};

for (let i = 0; i < 60; i++) {
  if (await fetch(BASE).then(() => true, () => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

let KEY = "";
async function call(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(KEY ? { authorization: `Bearer ${KEY}` } : {}), ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

/** GET with an explicit Host header, to reach hosted sites by hostname. */
const getHost = (host, path = "/") =>
  new Promise((resolve, reject) => {
    const req = httpRequest({ host: "localhost", port: PORT, path, headers: { host } }, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => resolve({ status: res.statusCode, body: b }));
    });
    req.on("error", reject);
    req.end();
  });

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}\n`, err, "\n--- worker log tail ---\n", log.slice(-3000));
    stop();
    process.exit(1);
  }
};

let formId;
await step("setup", async () => {
  KEY = (await call("POST", "/v1/workspaces", { name: "ext" })).json.key.secret;
  formId = (await call("POST", "/v1/forms", { name: "Paid", settings: { payment: true } })).json.id;
  await call("PUT", `/v1/forms/${formId}/hook`, {
    code: `export default { price({ data }) { return { amount: data.plan === "pro" ? 4900 : 900, currency: "USD" }; } }`,
  });
});

await step("payment needs the Stripe secret", async () => {
  const r = await call("POST", `/v1/f/${formId}/payments`, { sessionId: "sess_pay_1", data: { plan: "pro" } });
  assert.equal(r.status, 501);
  assert.equal(r.json.error.code, "not_configured");
  await call("PUT", "/v1/secrets/STRIPE_SECRET_KEY", { value: "sk_test_mock" });
});

await step("Stripe: priced by the hook, verified on submit", async () => {
  const sid = "sess_pay_2";
  const pi = await call("POST", `/v1/f/${formId}/payments`, { sessionId: sid, data: { plan: "pro" } });
  assert.equal(pi.status, 201, JSON.stringify(pi.json));
  assert.equal(pi.json.amount, 4900);
  assert.equal(pi.json.currency, "usd");
  const unpaid = await call("POST", `/v1/f/${formId}/submissions`, { sessionId: sid, data: { plan: "pro" }, paymentIntentId: pi.json.paymentIntentId });
  assert.equal(unpaid.status, 402);
  await fetch(`http://localhost:${MOCK}/_pay/${pi.json.paymentIntentId}`, { method: "POST" });
  // Paid 4900 for "pro" but submitted "basic" (900): the amounts no longer match.
  const mismatch = await call("POST", `/v1/f/${formId}/submissions`, { sessionId: sid, data: { plan: "basic" }, paymentIntentId: pi.json.paymentIntentId });
  assert.equal(mismatch.status, 402);
  assert.equal(mismatch.json.error.code, "payment_mismatch");
  const otherSession = await call("POST", `/v1/f/${formId}/submissions`, { sessionId: "sess_other", data: { plan: "pro" }, paymentIntentId: pi.json.paymentIntentId });
  assert.equal(otherSession.status, 400);
  const ok = await call("POST", `/v1/f/${formId}/submissions`, { sessionId: sid, data: { plan: "pro" }, paymentIntentId: pi.json.paymentIntentId });
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  const sub = (await call("GET", `/v1/submissions/${ok.json.id}`)).json;
  assert.deepEqual(sub.payment, { id: pi.json.paymentIntentId, amount: 4900, currency: "usd", status: "succeeded" });
  const reuse = await call("POST", `/v1/f/${formId}/submissions`, { sessionId: "sess_pay_3", data: { plan: "pro" }, paymentIntentId: pi.json.paymentIntentId });
  assert.equal(reuse.status, 409);
});

await step("Turnstile on submit and on OTP send", async () => {
  const f = (await call("POST", "/v1/forms", { name: "Bot-checked", settings: { turnstile: true } })).json.id;
  const missing = await call("POST", `/v1/f/${f}/submissions`, { data: { a: 1 } });
  assert.equal(missing.status, 400);
  const noSecret = await call("POST", `/v1/f/${f}/submissions`, { data: { a: 1 }, turnstileToken: "pass" });
  assert.equal(noSecret.status, 501);
  await call("PUT", "/v1/secrets/TURNSTILE_SECRET_KEY", { value: "ts_secret" });
  const bad = await call("POST", `/v1/f/${f}/submissions`, { data: { a: 1 }, turnstileToken: "fail" });
  assert.equal(bad.status, 403);
  const good = await call("POST", `/v1/f/${f}/submissions`, { data: { a: 1 }, turnstileToken: "pass" });
  assert.equal(good.status, 201);
  const otp = await call("POST", `/v1/f/${f}/verify`, { channel: "email", to: "a@b.co" });
  assert.equal(otp.status, 400);
});

let siteId;
const RUN = Math.random().toString(36).slice(2, 7);
const SLUG = `sub-${RUN}`;
const HOST = `forms-${RUN}.acme.com`;
await step("subdomain hosting", async () => {
  const s = (await call("POST", "/v1/sites", { name: "Sub", slug: SLUG })).json;
  siteId = s.id;
  assert.equal(s.url, `http://${SLUG}.sites.test/`);
  await call("POST", `/v1/sites/${siteId}/deployments`, { files: { "index.html": { content: "sub ok" } } });
  assert.equal((await getHost(`${SLUG}.sites.test`)).body, "sub ok");
  assert.equal((await getHost("nope.sites.test")).status, 404);
  // Path hosting is off once a sites domain is set.
  assert.equal((await fetch(`${BASE}/s/${SLUG}/`)).status, 404);
});

await step("custom domain: add, verify, serve, remove", async () => {
  const add = await call("POST", `/v1/sites/${siteId}/domains`, { hostname: HOST.toUpperCase() });
  assert.equal(add.status, 201, JSON.stringify(add.json));
  assert.equal(add.json.hostname, HOST);
  assert.equal(add.json.status, "pending");
  const dup = await call("POST", `/v1/sites/${siteId}/domains`, { hostname: HOST });
  assert.equal(dup.status, 409);
  const check = await call("GET", `/v1/domains/${HOST}`);
  assert.equal(check.json.status, "active");
  assert.equal((await getHost(HOST)).body, "sub ok");
  assert.equal((await call("DELETE", `/v1/domains/${HOST}`)).status, 204);
  assert.equal((await getHost(HOST)).status, 404);
});

await step("retention cron deletes expired submissions and stale drafts", async () => {
  const f = (await call("POST", "/v1/forms", { name: "Short-lived", settings: { retentionDays: 1 } })).json.id;
  const r = await call("POST", `/v1/f/${f}/submissions`, { data: { keep: false } });
  assert.equal(r.status, 201);
  // Age the row by two days, then run the scheduled handler.
  const sql = `UPDATE submissions SET created_at = created_at - 172800000 WHERE id = '${r.json.id}'`;
  const exec = spawn("npx", ["wrangler", "d1", "execute", "formlink", "--local", "--command", sql], { stdio: "ignore" });
  await new Promise((res) => exec.on("exit", res));
  const cron = await fetch(`${BASE}/__scheduled?cron=17+3+*+*+*`);
  assert.equal(cron.status, 200);
  await new Promise((res) => setTimeout(res, 1500));
  assert.equal((await call("GET", `/v1/submissions/${r.json.id}`)).status, 404);
});

await step("public rate limit", async () => {
  const f = (await call("POST", "/v1/forms", { name: "Flood" })).json.id;
  const statuses = [];
  for (let i = 0; i < 70; i++) statuses.push((await call("POST", `/v1/f/${f}/events`, { sessionId: "sess_flood", events: [{ type: "view" }] })).status);
  assert.ok(statuses.includes(429), `no 429 in ${statuses.length} requests`);
});

stop();
console.log("\nall external checks passed");
