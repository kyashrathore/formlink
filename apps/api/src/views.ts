/**
 * Views are saved HTML pages over a workspace's data. One file runs in two places:
 * - shared by link: a private Formlink-hosted site, where /_formlink/view.js talks to the REST API;
 * - inside Claude: an MCP App, where the same `window.formlink` calls MCP tools through the host.
 * A view only uses `formlink.call(tool, args)` with read-only tool names, so it doesn't care which.
 */

/** Read-only tools a view may call, with their REST equivalents for the hosted runtime. */
export const VIEW_TOOLS = ["list_forms", "get_form", "query_submissions", "get_submission", "get_analytics", "export_submissions"];

export const VIEW_RUNTIME_TAG = '<script src="/_formlink/view.js"></script>';

/** Served at /_formlink/view.js: `formlink.call` mapped onto the REST API with the share-link cookie. */
export const VIEW_RUNTIME_REST = String.raw`(() => {
  const m = location.pathname.match(/^\/s\/([a-z0-9-]+)\//);
  const headers = m ? { "x-formlink-site": m[1] } : {};
  const qs = (o) => { const q = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) q.set(k, String(v)); const s = q.toString(); return s ? "?" + s : ""; };
  async function get(path, text) {
    const res = await fetch(path, { headers, credentials: "same-origin" });
    if (!res.ok) { let msg = res.statusText; try { msg = (await res.json()).error.message; } catch {} throw new Error(msg); }
    return text ? res.text() : res.json();
  }
  const routes = {
    list_forms: () => get("/v1/forms").then((r) => r.forms),
    get_form: ({ formId }) => get("/v1/forms/" + formId),
    query_submissions: ({ formId, ...q }) => get("/v1/forms/" + formId + "/submissions" + qs(q)),
    get_submission: ({ submissionId }) => get("/v1/submissions/" + submissionId),
    get_analytics: ({ formId, ...q }) => get("/v1/forms/" + formId + "/analytics" + qs(q)),
    export_submissions: ({ formId, format }) => get("/v1/forms/" + formId + "/export" + qs({ format }), true),
  };
  window.formlink = {
    mode: "web",
    call(tool, args = {}) {
      const route = routes[tool];
      return route ? route(args) : Promise.reject(new Error("Views can't call " + tool));
    },
  };
})();`;

/** Injected into the view when it runs inside Claude: calls go to the parent MCP App bridge. */
const VIEW_RUNTIME_BRIDGE = String.raw`<script>(() => {
  let n = 0; const pending = new Map();
  addEventListener("message", (e) => {
    const d = e.data; if (!d || d.type !== "formlink-result" || !pending.has(d.id)) return;
    const { resolve, reject } = pending.get(d.id); pending.delete(d.id);
    d.error ? reject(new Error(d.error)) : resolve(d.result);
  });
  window.formlink = {
    mode: "mcp-app",
    call(tool, args = {}) {
      return new Promise((resolve, reject) => { const id = ++n; pending.set(id, { resolve, reject }); parent.postMessage({ type: "formlink-call", id, tool, args }, "*"); });
    },
  };
  const report = () => parent.postMessage({ type: "formlink-size", height: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0) }, "*");
  addEventListener("load", () => { report(); new ResizeObserver(report).observe(document.documentElement); });
})();</script>`;

/** Swaps the hosted runtime for the MCP bridge, or adds the bridge if the view forgot the tag. */
export function viewForMcpApp(html: string) {
  if (html.includes(VIEW_RUNTIME_TAG)) return html.replace(VIEW_RUNTIME_TAG, VIEW_RUNTIME_BRIDGE);
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + VIEW_RUNTIME_BRIDGE) : VIEW_RUNTIME_BRIDGE + html;
}

export const VIEW_APP_URI = "ui://formlink/view";
export const MCP_APP_MIME = "text/html;profile=mcp-app";

/**
 * The MCP App shell. It does the ui/initialize handshake with the host, receives the show_view result,
 * renders the view in a sandboxed frame, and relays the view's read-only tool calls to the host.
 */
export const VIEW_APP_HTML = String.raw`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;font:14px system-ui,sans-serif}iframe{display:block;width:100%;border:0;height:200px}#msg{padding:12px;color:#666}</style>
</head><body><div id="msg">Loading view…</div><iframe id="view" sandbox="allow-scripts allow-forms allow-popups" hidden></iframe>
<script>
const READ_ONLY = ${JSON.stringify(VIEW_TOOLS)};
let seq = 0; const waiting = new Map(); let ready = false;
const frame = document.getElementById("view"); const msg = document.getElementById("msg");
function send(obj) { parent.postMessage(obj, "*"); }
function rpc(method, params) { const id = ++seq; send({ jsonrpc: "2.0", id, method, params }); return new Promise((res, rej) => waiting.set(id, { res, rej })); }
function notify(method, params) { send({ jsonrpc: "2.0", method, params }); }
function size(h) { if (ready) notify("ui/notifications/size-changed", { height: Math.max(120, h) }); }

addEventListener("message", async (e) => {
  const d = e.data;
  if (e.source === frame.contentWindow) {
    if (d && d.type === "formlink-size") { frame.style.height = d.height + "px"; size(d.height); }
    if (d && d.type === "formlink-call") {
      const reply = (x) => frame.contentWindow.postMessage({ type: "formlink-result", id: d.id, ...x }, "*");
      if (!READ_ONLY.includes(d.tool)) return reply({ error: "Views can't call " + d.tool });
      try {
        const r = await rpc("tools/call", { name: d.tool, arguments: d.args || {} });
        if (r.isError) return reply({ error: (r.content && r.content[0] && r.content[0].text) || "Tool failed" });
        let result = r.structuredContent;
        if (result === undefined) { const t = r.content && r.content[0] && r.content[0].text; try { result = JSON.parse(t); } catch { result = t; } }
        reply({ result });
      } catch (err) { reply({ error: String(err && err.message || err) }); }
    }
    return;
  }
  if (!d || d.jsonrpc !== "2.0") return;
  if (d.id !== undefined && waiting.has(d.id) && !d.method) {
    const w = waiting.get(d.id); waiting.delete(d.id);
    return d.error ? w.rej(new Error(d.error.message)) : w.res(d.result);
  }
  if (d.method === "ui/notifications/tool-result") {
    const view = d.params && d.params.structuredContent && d.params.structuredContent.view;
    if (!view || !view.html) { msg.textContent = (d.params && d.params.content && d.params.content[0] && d.params.content[0].text) || "No view to show."; return; }
    msg.hidden = true; frame.hidden = false; frame.srcdoc = view.html;
  }
  if (d.method === "ui/resource-teardown" && d.id !== undefined) send({ jsonrpc: "2.0", id: d.id, result: {} });
});

(async function init() {
  const started = Date.now(); let delay = 400;
  while (true) {
    try {
      await Promise.race([
        rpc("ui/initialize", { appInfo: { name: "formlink-view", version: "0.1.0" }, appCapabilities: { availableDisplayModes: ["inline"] }, protocolVersion: "2026-01-26" }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), delay)),
      ]);
      break;
    } catch {
      if (Date.now() - started > 30000) { msg.textContent = "Couldn't connect to the host."; return; }
      delay = Math.min(delay * 2, 5000);
    }
  }
  notify("ui/notifications/initialized", {});
  ready = true; size(document.documentElement.scrollHeight);
})();
</script></body></html>`;
