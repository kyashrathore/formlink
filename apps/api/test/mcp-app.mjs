// A saved view, written once, rendered two ways in Chromium:
// 1. inside a simulated MCP Apps host (ui/initialize handshake, tool-result, tools/call relayed to /mcp);
// 2. as a private hosted page opened by its share link (REST runtime at /_formlink/view.js).
// Needs `pnpm dev`.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const BASE = process.env.FORMLINK_URL ?? "http://localhost:8787";
let KEY = "";
const call = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await res.text();
  return t ? JSON.parse(t) : null;
};
let rpcId = 0;
const mcp = async (method, params) => {
  const out = await call("POST", "/mcp", { jsonrpc: "2.0", id: ++rpcId, method, params });
  if (out.error) throw new Error(out.error.message);
  return out.result;
};

KEY = (await call("POST", "/v1/workspaces", { name: "views" })).key.secret;
const form = await call("POST", "/v1/forms", { name: "Signups" });
for (const plan of ["pro", "pro", "free"]) await call("POST", `/v1/f/${form.id}/submissions`, { data: { plan } });

const VIEW = `<!doctype html><html><head><meta charset="utf-8"><script src="/_formlink/view.js"></script></head>
<body><h1>Signups by plan</h1><ul id="out"><li>loading</li></ul><p id="mode"></p>
<script>
(async () => {
  const { submissions } = await formlink.call("query_submissions", { formId: "${form.id}", limit: 500 });
  const counts = {};
  for (const s of submissions) counts[s.data.plan] = (counts[s.data.plan] || 0) + 1;
  document.getElementById("out").innerHTML = Object.entries(counts).sort().map(([k, v]) => "<li>" + k + ": " + v + "</li>").join("");
  document.getElementById("mode").textContent = formlink.mode;
  try { await formlink.call("delete_form", { formId: "${form.id}" }); } catch (e) { document.getElementById("mode").textContent += " | blocked: " + e.message; }
})();
</script></body></html>`;

// save_view through MCP, then check the MCP surface a host sees.
const saved = (await mcp("tools/call", { name: "save_view", arguments: { name: "Plans", dataForms: [form.id], html: VIEW } })).structuredContent;
assert.ok(saved.shareUrl.includes("token="));
const tools = (await mcp("tools/list")).tools;
assert.deepEqual(tools.find((t) => t.name === "show_view")._meta, { ui: { resourceUri: "ui://formlink/view" } });
const res = (await mcp("resources/read", { uri: "ui://formlink/view" })).contents[0];
assert.equal(res.mimeType, "text/html;profile=mcp-app");
const shown = await mcp("tools/call", { name: "show_view", arguments: { siteId: saved.id } });
assert.match(shown.content[0].text, /Showing "Plans"/);
assert.ok(!shown.content[0].text.includes("<html"), "model text should not carry the HTML");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

// 1. Inside a simulated MCP Apps host.
const host = await browser.newPage();
const relayed = [];
await host.exposeFunction("mcpCall", async (name, args) => {
  relayed.push(name);
  return mcp("tools/call", { name, arguments: args });
});
await host.setContent(`<iframe id="app" style="width:600px;height:400px"></iframe>`);
await host.evaluate(
  ({ appHtml, toolResult }) => {
    const app = document.getElementById("app");
    window.sizes = [];
    window.addEventListener("message", async (e) => {
      if (e.source !== app.contentWindow) return;
      const m = e.data;
      const reply = (result) => app.contentWindow.postMessage({ jsonrpc: "2.0", id: m.id, result }, "*");
      if (m.method === "ui/initialize") reply({ protocolVersion: "2026-01-26", hostInfo: { name: "test-host" }, hostCapabilities: {}, hostContext: {} });
      if (m.method === "ui/notifications/initialized") {
        app.contentWindow.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-input", params: { arguments: {} } }, "*");
        app.contentWindow.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: toolResult }, "*");
      }
      if (m.method === "ui/notifications/size-changed") window.sizes.push(m.params.height);
      if (m.method === "tools/call") reply(await window.mcpCall(m.params.name, m.params.arguments));
    });
    app.srcdoc = appHtml;
  },
  { appHtml: res.text, toolResult: shown },
);
const view = host.frameLocator("#app").frameLocator("#view");
await view.getByText("pro: 2").waitFor({ timeout: 15000 });
assert.equal(await view.locator("#out").innerText(), "free: 1\npro: 2");
await view.getByText("blocked: Views can't call delete_form").waitFor();
assert.match(await view.locator("#mode").innerText(), /^mcp-app/);
assert.deepEqual(relayed, ["query_submissions"]);
assert.ok((await host.evaluate(() => window.sizes.length)) > 0, "app reported its size");

// 2. The same file as a hosted private page via its share link.
const page = await browser.newPage();
await page.goto(saved.shareUrl);
await page.getByText("pro: 2").waitFor({ timeout: 15000 });
assert.equal(await page.locator("#out").innerText(), "free: 1\npro: 2");
await page.getByText("blocked: Views can't call delete_form").waitFor();
assert.match(await page.locator("#mode").innerText(), /^web/);
await browser.close();
assert.equal((await call("GET", `/v1/forms/${form.id}`)).id, form.id, "form still exists");
console.log("mcp-app check passed: one view rendered inside an MCP Apps host and via its share link");
