// Local stand-ins for Stripe, Turnstile and the Cloudflare custom hostnames API.
import { createServer } from "node:http";

const intents = new Map();
const hostnames = new Map();
let n = 0;

export function startMocks(port) {
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const url = new URL(req.url, `http://localhost:${port}`);
    const json = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const p = url.pathname;

    // Stripe
    if (p.startsWith("/stripe/")) {
      if (req.headers.authorization !== "Bearer sk_test_mock") return json(401, { error: { message: "Invalid API Key" } });
      if (req.method === "POST" && p === "/stripe/payment_intents") {
        const f = new URLSearchParams(raw);
        const id = `pi_mock${++n}`;
        const pi = {
          id,
          status: "requires_payment_method",
          amount: Number(f.get("amount")),
          amount_received: 0,
          currency: f.get("currency"),
          client_secret: `${id}_secret_x`,
          metadata: { formlink_form: f.get("metadata[formlink_form]"), formlink_session: f.get("metadata[formlink_session]") },
        };
        intents.set(id, pi);
        return json(200, pi);
      }
      const m = p.match(/^\/stripe\/payment_intents\/(pi_\w+)$/);
      if (req.method === "GET" && m) {
        const pi = intents.get(m[1]);
        return pi ? json(200, pi) : json(404, { error: { message: "No such payment_intent" } });
      }
    }
    // Test control: a delayed method (bank debit) leaves the PaymentIntent processing.
    const proc = p.match(/^\/_process\/(pi_\w+)$/);
    if (proc) {
      const pi = intents.get(proc[1]);
      pi.status = "processing";
      return json(200, pi);
    }
    // Test control: mark a PaymentIntent paid, as Stripe.js confirmation would.
    const paid = p.match(/^\/_pay\/(pi_\w+)$/);
    if (paid) {
      const pi = intents.get(paid[1]);
      pi.status = "succeeded";
      pi.amount_received = pi.amount;
      return json(200, pi);
    }

    // Turnstile
    if (p === "/turnstile") {
      const f = new URLSearchParams(raw);
      return json(200, { success: f.get("secret") === "ts_secret" && f.get("response") === "pass" });
    }

    // Cloudflare custom hostnames
    const ch = p.match(/^\/cf\/zones\/[^/]+\/custom_hostnames(?:\/([\w-]+))?$/);
    if (ch) {
      if (req.headers.authorization !== "Bearer cf_mock") return json(403, { success: false, errors: [{ message: "Auth" }], result: null });
      if (req.method === "POST") {
        const body = JSON.parse(raw);
        const r = { id: `ch${++n}`, hostname: body.hostname, status: "pending", ssl: { status: "pending_validation" } };
        hostnames.set(r.id, r);
        return json(200, { success: true, errors: [], result: r });
      }
      const r = hostnames.get(ch[1]);
      if (!r) return json(404, { success: false, errors: [{ message: "Not found" }], result: null });
      if (req.method === "DELETE") {
        hostnames.delete(r.id);
        return json(200, { success: true, errors: [], result: { id: r.id } });
      }
      // Second read: verification finished.
      r.status = "active";
      r.ssl = { status: "active" };
      return json(200, { success: true, errors: [], result: r });
    }
    json(404, { error: "mock: no route" });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
