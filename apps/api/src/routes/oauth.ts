import { Hono } from "hono";
import type { AppEnv } from "@/lib/http";
import { authenticateKey } from "@/services/workspaces";

/**
 * OAuth consent for MCP clients (claude.ai, ChatGPT...). There are no passwords:
 * the user proves workspace access by pasting an API key once; the client gets its own token.
 */
export const oauth = new Hono<AppEnv>();

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function page(clientName: string, error?: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Formlink</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:420px;margin:12vh auto;padding:0 16px;color:#111}
input{width:100%;box-sizing:border-box;padding:10px;font:inherit;border:1px solid #bbb;border-radius:8px}
button{margin-top:12px;padding:10px 16px;font:inherit;border:0;border-radius:8px;background:#111;color:#fff;cursor:pointer}
.err{color:#b00020}@media (prefers-color-scheme:dark){body{background:#111;color:#eee}input{background:#222;color:#eee;border-color:#444}button{background:#eee;color:#111}}</style></head>
<body><h1>Connect Formlink</h1><p><b>${esc(clientName)}</b> wants access to your Formlink workspace.</p>
<form method="post"><label for="key">Paste a Formlink API key (fl_sk_...)</label><br><input id="key" name="key" type="password" autocomplete="off" required>
${error ? `<p class="err">${esc(error)}</p>` : ""}<button type="submit">Allow access</button></form>
<p>No workspace yet? Create one with <code>POST /v1/workspaces</code>.</p></body></html>`;
}

oauth.get("/authorize", async (c) => {
  const req = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const client = await c.env.OAUTH_PROVIDER.lookupClient(req.clientId);
  return c.html(page(client?.clientName ?? req.clientId));
});

oauth.post("/authorize", async (c) => {
  // Re-parse from the query string so the request can't be swapped in the form body.
  const req = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const client = await c.env.OAUTH_PROVIDER.lookupClient(req.clientId);
  const form = await c.req.formData();
  try {
    const auth = await authenticateKey(c.env, String(form.get("key") ?? "").trim());
    const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
      request: req,
      userId: auth.workspaceId,
      metadata: { client: client?.clientName ?? req.clientId },
      scope: req.scope,
      props: auth,
    });
    return c.redirect(redirectTo, 302);
  } catch {
    return c.html(page(client?.clientName ?? req.clientId, "That key is not valid."), 401);
  }
});
