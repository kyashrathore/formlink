import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Auth, Env } from "@/env";
import { GUIDE } from "@/guide";
import { ApiError } from "@/lib/errors";
import { type AppEnv, errorResponse } from "@/lib/http";
import { handleMcp } from "@/mcp/server";
import { admin } from "@/routes/admin";
import { oauth } from "@/routes/oauth";
import { publicApi } from "@/routes/public";
import { runRetention } from "@/services/retention";
import { type Site, serveSite, siteAuth, siteForHost, siteForSlug } from "@/services/sites";
import { authenticateKey, isApiKey } from "@/services/workspaces";

/** Read-only access granted to a private site's own pages, keyed by the incoming Request. */
const siteAuths = new WeakMap<Request, Auth | null>();

const app = new Hono<AppEnv>();
app.onError((err) => errorResponse(err));
app.use("/v1/*", cors({ origin: (o) => o || "*", allowHeaders: ["content-type", "authorization", "x-formlink-site"], maxAge: 600 }));
app.use("/v1/*", async (c, next) => {
  c.set("siteAuth", siteAuths.get(c.req.raw) ?? null);
  await next();
});
app.get("/", (c) =>
  c.json({ name: "formlink", docs: `${c.env.PUBLIC_URL}/llms.txt`, mcp: `${c.env.PUBLIC_URL}/mcp`, api: `${c.env.PUBLIC_URL}/v1` }),
);
app.get("/llms.txt", (c) => c.text(GUIDE.replaceAll("<api>", c.env.PUBLIC_URL)));
app.route("/v1/f", publicApi);
app.route("/v1", admin);
app.route("/", oauth);
app.notFound((c) => c.json({ error: { code: "not_found", message: "Route not found" } }, 404));

const mcpApi = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const auth = ctx.props as Auth;
    // OAuth grants outlive nothing: revoking the key that approved them cuts the client off.
    const key = await env.DB.prepare("SELECT revoked_at FROM api_keys WHERE id = ?").bind(auth.keyId ?? "").first<{ revoked_at: number | null }>();
    if (!key || key.revoked_at) return errorResponse(new ApiError(401, "unauthorized", "The key behind this connection was revoked"));
    return handleMcp(request, env, ctx, auth);
  },
};

// The protected resource URL depends on PUBLIC_URL, so the provider is built on first use.
let provider: OAuthProvider<Env> | undefined;
const oauthProvider = (env: Env) =>
  (provider ??= new OAuthProvider<Env>({
    apiRoute: "/mcp",
    apiHandler: mcpApi,
    defaultHandler: { fetch: (req, env, ctx) => app.fetch(req, env, ctx) },
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
    resourceMetadata: { resource: `${env.PUBLIC_URL}/mcp`, resource_name: "Formlink" },
  }));

async function routeSite(request: Request, env: Env, ctx: ExecutionContext, site: Site, path: string, base: string) {
  // API calls from a site's own pages: same origin, plus read access for private views.
  if (path.startsWith("/v1/")) {
    const url = new URL(request.url);
    url.pathname = path;
    const forwarded = new Request(url, request);
    siteAuths.set(forwarded, await siteAuth(env, site, request));
    return app.fetch(forwarded, env, ctx);
  }
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  return serveSite(env, site, request, path, base);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const apiHost = new URL(env.PUBLIC_URL).host;

      // Hosted sites on <slug>.<SITES_DOMAIN> or a connected custom domain.
      if (url.host !== apiHost) {
        const site = await siteForHost(env, url.host);
        if (site) return routeSite(request, env, ctx, site, url.pathname, "/");
        if (env.SITES_DOMAIN) return new Response("Not found", { status: 404 });
      }

      // Path-based hosting for local dev, only when no sites domain is configured: sites sharing
      // the API origin can't be isolated from each other.
      const m = env.SITES_DOMAIN ? null : url.pathname.match(/^\/s\/([a-z0-9-]+)(\/.*)?$/);
      if (m) {
        const site = await siteForSlug(env, m[1]!);
        if (!site) return new Response("Not found", { status: 404 });
        if (!m[2]) return Response.redirect(`${url.origin}/s/${m[1]}/${url.search}`, 301);
        return routeSite(request, env, ctx, site, m[2], "/");
      }

      // Private views served under /s/<slug>/ identify themselves with x-formlink-site. The referer must be
      // that site's own page, so another page on this origin can't borrow its cookie.
      const siteSlug = request.headers.get("x-formlink-site");
      if (siteSlug && url.pathname.startsWith("/v1/")) {
        const referer = request.headers.get("referer");
        const fromSite = referer && new URL(referer).origin === url.origin && new URL(referer).pathname.startsWith(`/s/${siteSlug}/`);
        const site = fromSite ? await siteForSlug(env, siteSlug) : null;
        if (site) siteAuths.set(request, await siteAuth(env, site, request));
      }

      // MCP with a raw API key (Claude Code, scripts) skips OAuth.
      const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (url.pathname === "/mcp" && isApiKey(bearer)) {
        return handleMcp(request, env, ctx, await authenticateKey(env, bearer));
      }

      return oauthProvider(env).fetch(request, env, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runRetention(env).then((r) => console.log("retention", r)));
  },
} satisfies ExportedHandler<Env>;
