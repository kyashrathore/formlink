import { z } from "zod";
import type { Auth, Env } from "@/env";
import { fromBase64, signToken, verifyToken } from "@/lib/crypto";
import { ApiError, badRequest, notFound } from "@/lib/errors";
import { newId, now, randomString } from "@/lib/ids";
import { parseJson } from "@/lib/json";
import { getForm } from "@/services/forms";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(["www", "api", "app", "admin", "mcp", "auth", "oauth", "docs", "status", "mail"]);
const MAX_FILES = 1000;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

export const SiteInput = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().regex(SLUG, "3-40 chars: lowercase letters, digits and dashes").optional(),
  /** Private sites need the share link (or a cookie it sets) and may read `dataForms` submissions. */
  visibility: z.enum(["public", "private"]).default("public"),
  dataForms: z.array(z.string()).default([]),
});

export const SiteUpdate = SiteInput.partial().extend({ rotateShareToken: z.boolean().optional() });

export const DeployInput = z.object({
  /** Path -> file. Text by default; binary files use encoding "base64". */
  files: z.record(
    z.string().min(1).max(512),
    z.object({
      content: z.string(),
      encoding: z.enum(["utf8", "base64"]).default("utf8"),
      contentType: z.string().optional(),
    }),
  ),
});

interface SiteRow {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  visibility: "public" | "private";
  share_token: string;
  data_forms: string;
  active_deployment: string | null;
  created_at: number;
  updated_at: number;
}
export type Site = SiteRow;

interface DomainRow {
  hostname: string;
  site_id: string;
  workspace_id: string;
  cf_id: string | null;
  status: string;
  verification: string | null;
  created_at: number;
}

export function siteBaseUrl(env: Env, site: Pick<SiteRow, "slug">) {
  if (env.SITES_DOMAIN) {
    const proto = env.PUBLIC_URL.startsWith("http://") ? "http" : "https";
    return `${proto}://${site.slug}.${env.SITES_DOMAIN}/`;
  }
  return `${env.PUBLIC_URL}/s/${site.slug}/`;
}

async function toSite(env: Env, row: SiteRow) {
  const { results: domains } = await env.DB.prepare("SELECT hostname, status FROM domains WHERE site_id = ?")
    .bind(row.id)
    .all<{ hostname: string; status: string }>();
  const url = siteBaseUrl(env, row);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    visibility: row.visibility,
    dataForms: parseJson<string[]>(row.data_forms, []),
    url,
    shareUrl: row.visibility === "private" ? `${url}?token=${row.share_token}` : url,
    domains,
    activeDeployment: row.active_deployment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function siteRow(env: Env, auth: Auth, siteId: string) {
  const row = await env.DB.prepare("SELECT * FROM sites WHERE id = ? AND workspace_id = ?")
    .bind(siteId, auth.workspaceId)
    .first<SiteRow>();
  if (!row) throw notFound("Site");
  return row;
}

async function checkDataForms(env: Env, auth: Auth, formIds: string[]) {
  for (const id of formIds) await getForm(env, auth, id);
}

export async function createSite(env: Env, auth: Auth, input: z.infer<typeof SiteInput>) {
  const base = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "site";
  const slug = input.slug ?? `${base.length >= 3 ? base : `${base}-site`}-${randomString(5)}`;
  if (!SLUG.test(slug) || RESERVED.has(slug)) throw badRequest(`Slug "${slug}" is not available`);
  await checkDataForms(env, auth, input.dataForms);
  const id = newId("sit");
  const t = now();
  try {
    await env.DB.prepare(
      "INSERT INTO sites (id, workspace_id, slug, name, visibility, share_token, data_forms, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, auth.workspaceId, slug, input.name, input.visibility, randomString(32), JSON.stringify(input.dataForms), t, t)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new ApiError(409, "conflict", `Slug "${slug}" is taken`);
    throw err;
  }
  return getSite(env, auth, id);
}

export async function getSite(env: Env, auth: Auth, siteId: string) {
  return toSite(env, await siteRow(env, auth, siteId));
}

export async function listSites(env: Env, auth: Auth) {
  const { results } = await env.DB.prepare("SELECT * FROM sites WHERE workspace_id = ? ORDER BY created_at DESC")
    .bind(auth.workspaceId)
    .all<SiteRow>();
  return Promise.all(results.map((r) => toSite(env, r)));
}

export async function updateSite(env: Env, auth: Auth, siteId: string, input: z.infer<typeof SiteUpdate>) {
  const row = await siteRow(env, auth, siteId);
  if (input.slug && (!SLUG.test(input.slug) || RESERVED.has(input.slug))) throw badRequest("Slug is not available");
  if (input.dataForms) await checkDataForms(env, auth, input.dataForms);
  await env.DB.prepare(
    "UPDATE sites SET name = ?, slug = ?, visibility = ?, data_forms = ?, share_token = ?, updated_at = ? WHERE id = ?",
  )
    .bind(
      input.name ?? row.name,
      input.slug ?? row.slug,
      input.visibility ?? row.visibility,
      input.dataForms ? JSON.stringify(input.dataForms) : row.data_forms,
      input.rotateShareToken ? randomString(32) : row.share_token,
      now(),
      siteId,
    )
    .run();
  return getSite(env, auth, siteId);
}

export async function deleteSite(env: Env, auth: Auth, siteId: string) {
  await siteRow(env, auth, siteId);
  const { results } = await env.DB.prepare("SELECT hostname FROM domains WHERE site_id = ?")
    .bind(siteId)
    .all<{ hostname: string }>();
  for (const d of results) await removeDomain(env, auth, d.hostname);
  await deletePrefix(env, `sites/${siteId}/`);
  await env.DB.prepare("DELETE FROM sites WHERE id = ?").bind(siteId).run();
}

async function deletePrefix(env: Env, prefix: string) {
  let cursor: string | undefined;
  do {
    const list = await env.FILES.list({ prefix, cursor });
    if (list.objects.length) await env.FILES.delete(list.objects.map((o) => o.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
}

function normalizePath(path: string) {
  const p = path.replace(/^\.?\/+/, "");
  if (!p || p.split("/").some((seg) => seg === ".." || seg === "")) throw badRequest(`Invalid path: ${path}`);
  return p;
}

/** Uploads a complete build and makes it live. Old deployments are kept for rollback. */
export async function deploySite(env: Env, auth: Auth, siteId: string, input: z.infer<typeof DeployInput>) {
  const site = await siteRow(env, auth, siteId);
  const entries = Object.entries(input.files);
  if (!entries.length) throw badRequest("No files to deploy");
  if (entries.length > MAX_FILES) throw badRequest(`Deployments are limited to ${MAX_FILES} files`);
  const files = entries.map(([path, f]) => {
    const body = f.encoding === "base64" ? fromBase64(f.content) : new TextEncoder().encode(f.content);
    const p = normalizePath(path);
    return { path: p, body, type: f.contentType ?? contentType(p) };
  });
  const total = files.reduce((n, f) => n + f.body.byteLength, 0);
  if (total > MAX_TOTAL_BYTES) throw new ApiError(413, "too_large", "Deployments are limited to 25MB");
  if (!files.some((f) => f.path === "index.html")) throw badRequest("A deployment needs an index.html");

  const id = newId("dep");
  await Promise.all(
    files.map((f) => env.FILES.put(`sites/${siteId}/${id}/${f.path}`, f.body, { httpMetadata: { contentType: f.type } })),
  );
  const manifest = Object.fromEntries(files.map((f) => [f.path, { size: f.body.byteLength, type: f.type }]));
  await env.DB.batch([
    env.DB.prepare("INSERT INTO deployments (id, site_id, manifest, created_at) VALUES (?, ?, ?, ?)").bind(
      id,
      siteId,
      JSON.stringify(manifest),
      now(),
    ),
    env.DB.prepare("UPDATE sites SET active_deployment = ?, updated_at = ? WHERE id = ?").bind(id, now(), siteId),
  ]);
  return { deploymentId: id, files: files.length, bytes: total, site: await toSite(env, { ...site, active_deployment: id }) };
}

export async function listDeployments(env: Env, auth: Auth, siteId: string) {
  await siteRow(env, auth, siteId);
  const { results } = await env.DB.prepare(
    "SELECT id, manifest, created_at FROM deployments WHERE site_id = ? ORDER BY created_at DESC LIMIT 50",
  )
    .bind(siteId)
    .all<{ id: string; manifest: string; created_at: number }>();
  return results.map((d) => ({
    id: d.id,
    files: Object.keys(parseJson<Record<string, unknown>>(d.manifest, {})).length,
    createdAt: d.created_at,
  }));
}

export async function rollbackSite(env: Env, auth: Auth, siteId: string, deploymentId: string) {
  await siteRow(env, auth, siteId);
  const dep = await env.DB.prepare("SELECT id FROM deployments WHERE id = ? AND site_id = ?")
    .bind(deploymentId, siteId)
    .first();
  if (!dep) throw notFound("Deployment");
  await env.DB.prepare("UPDATE sites SET active_deployment = ?, updated_at = ? WHERE id = ?")
    .bind(deploymentId, now(), siteId)
    .run();
  return getSite(env, auth, siteId);
}

// ---- Custom domains (Cloudflare for SaaS custom hostnames) ----

async function cf<T>(env: Env, path: string, init?: { method: string; body?: unknown }) {
  if (!env.CF_ZONE_ID || !env.CF_API_TOKEN)
    throw new ApiError(501, "not_configured", "Custom domains need CF_ZONE_ID and CF_API_TOKEN on the server");
  const res = await fetch(`${env.CF_API_URL || "https://api.cloudflare.com/client/v4"}/zones/${env.CF_ZONE_ID}${path}`, {
    method: init?.method ?? "GET",
    headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json()) as { success: boolean; result: T; errors: { message: string }[] };
  if (!json.success) throw new ApiError(502, "cloudflare_error", json.errors.map((e) => e.message).join("; "));
  return json.result;
}

interface CustomHostname {
  id: string;
  status: string;
  ssl?: { status: string; validation_records?: unknown[] };
  ownership_verification?: unknown;
}

function domainInfo(env: Env, row: DomainRow) {
  return {
    hostname: row.hostname,
    status: row.status,
    dns: { type: "CNAME", name: row.hostname, target: env.SITES_DOMAIN ? `fallback.${env.SITES_DOMAIN}` : null },
    verification: parseJson<unknown>(row.verification, null),
  };
}

export async function addDomain(env: Env, auth: Auth, siteId: string, hostname: string) {
  await siteRow(env, auth, siteId);
  const host = hostname.trim().toLowerCase();
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) throw badRequest("Invalid hostname");
  if (env.SITES_DOMAIN && host.endsWith(env.SITES_DOMAIN)) throw badRequest("Use the site slug for this domain");
  const existing = await env.DB.prepare("SELECT hostname FROM domains WHERE hostname = ?").bind(host).first();
  if (existing) throw new ApiError(409, "conflict", "Hostname is already connected");
  const ch = await cf<CustomHostname>(env, "/custom_hostnames", {
    method: "POST",
    body: { hostname: host, ssl: { method: "http", type: "dv" } },
  });
  const row: DomainRow = {
    hostname: host,
    site_id: siteId,
    workspace_id: auth.workspaceId,
    cf_id: ch.id,
    status: ch.status,
    verification: JSON.stringify({ ownership: ch.ownership_verification ?? null, ssl: ch.ssl ?? null }),
    created_at: now(),
  };
  await env.DB.prepare(
    "INSERT INTO domains (hostname, site_id, workspace_id, cf_id, status, verification, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(row.hostname, row.site_id, row.workspace_id, row.cf_id, row.status, row.verification, row.created_at)
    .run();
  return domainInfo(env, row);
}

/** Re-reads the hostname's status from Cloudflare. */
export async function getDomain(env: Env, auth: Auth, hostname: string) {
  const row = await env.DB.prepare("SELECT * FROM domains WHERE hostname = ? AND workspace_id = ?")
    .bind(hostname, auth.workspaceId)
    .first<DomainRow>();
  if (!row) throw notFound("Domain");
  if (row.cf_id) {
    const ch = await cf<CustomHostname>(env, `/custom_hostnames/${row.cf_id}`);
    row.status = ch.status === "active" && ch.ssl?.status === "active" ? "active" : ch.status;
    row.verification = JSON.stringify({ ownership: ch.ownership_verification ?? null, ssl: ch.ssl ?? null });
    await env.DB.prepare("UPDATE domains SET status = ?, verification = ? WHERE hostname = ?")
      .bind(row.status, row.verification, row.hostname)
      .run();
  }
  return domainInfo(env, row);
}

export async function removeDomain(env: Env, auth: Auth, hostname: string) {
  const row = await env.DB.prepare("SELECT * FROM domains WHERE hostname = ? AND workspace_id = ?")
    .bind(hostname, auth.workspaceId)
    .first<DomainRow>();
  if (!row) throw notFound("Domain");
  if (row.cf_id) await cf(env, `/custom_hostnames/${row.cf_id}`, { method: "DELETE" });
  await env.DB.prepare("DELETE FROM domains WHERE hostname = ?").bind(hostname).run();
}

// ---- Serving ----

export async function siteForHost(env: Env, host: string): Promise<SiteRow | null> {
  const h = host.toLowerCase().split(":")[0]!;
  if (env.SITES_DOMAIN && h.endsWith(`.${env.SITES_DOMAIN}`)) {
    const slug = h.slice(0, -(env.SITES_DOMAIN.length + 1));
    return env.DB.prepare("SELECT * FROM sites WHERE slug = ?").bind(slug).first<SiteRow>();
  }
  return env.DB.prepare("SELECT s.* FROM sites s JOIN domains d ON d.site_id = s.id WHERE d.hostname = ?")
    .bind(h)
    .first<SiteRow>();
}

export async function siteForSlug(env: Env, slug: string) {
  return env.DB.prepare("SELECT * FROM sites WHERE slug = ?").bind(slug).first<SiteRow>();
}

const COOKIE = (site: SiteRow) => `fl_site_${site.id}`;
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(/;\s*/)) {
    const [k, ...v] = part.split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/** Read-only API access for a private site's own pages, scoped to its `dataForms`. */
export async function siteAuth(env: Env, site: SiteRow, request: Request): Promise<Auth | null> {
  if (site.visibility !== "private") return null;
  const cookie = readCookie(request, COOKIE(site));
  if (!cookie) return null;
  const p = await verifyToken<{ s: string; t: string; exp: number }>(env.SIGNING_KEY, cookie);
  if (!p || p.s !== site.id || p.t !== site.share_token) return null;
  return { workspaceId: site.workspace_id, role: "read", formIds: parseJson<string[]>(site.data_forms, []) };
}

export async function serveSite(env: Env, site: SiteRow, request: Request, path: string, basePath = "/") {
  const url = new URL(request.url);
  if (site.visibility === "private") {
    const token = url.searchParams.get("token");
    if (token) {
      if (token !== site.share_token) return new Response("Invalid share link", { status: 403 });
      const value = await signToken(env.SIGNING_KEY, { s: site.id, t: site.share_token, exp: Date.now() + SESSION_TTL_MS });
      url.searchParams.delete("token");
      const secure = url.protocol === "https:" ? "; Secure" : "";
      return new Response(null, {
        status: 302,
        headers: {
          location: url.pathname + url.search,
          "set-cookie": `${COOKIE(site)}=${value}; Path=${basePath}; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`,
        },
      });
    }
    if (!(await siteAuth(env, site, request))) return new Response("This page is private. Open it with its share link.", { status: 401 });
  }
  if (!site.active_deployment) return new Response("Nothing deployed yet", { status: 404 });

  const prefix = `sites/${site.id}/${site.active_deployment}/`;
  const clean = decodeURIComponent(path).replace(/^\/+/, "");
  const candidates = !clean || clean.endsWith("/") ? [`${clean}index.html`] : [clean, `${clean}/index.html`];
  // Extension-less paths fall back to the root index.html so client-side routers work.
  if (!/\.[a-z0-9]+$/i.test(clean)) candidates.push("index.html");
  for (const c of candidates) {
    if (c.split("/").includes("..")) break;
    const obj = await env.FILES.get(prefix + c);
    if (!obj) continue;
    const isHtml = c.endsWith(".html");
    return new Response(obj.body, {
      headers: {
        "content-type": obj.httpMetadata?.contentType ?? contentType(c),
        "cache-control": isHtml ? "no-cache" : "public, max-age=300",
        etag: obj.httpEtag,
      },
    });
  }
  return new Response("Not found", { status: 404 });
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml",
  webmanifest: "application/manifest+json",
  wasm: "application/wasm",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  pdf: "application/pdf",
};

export function contentType(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}

// ---- Views: private sites that read form data, also renderable inside Claude as an MCP App ----

/** Creates or updates a private single-page view over `dataForms`. */
export async function saveView(
  env: Env,
  auth: Auth,
  input: { siteId?: string; name: string; dataForms: string[]; html: string },
) {
  const site = input.siteId
    ? await updateSite(env, auth, input.siteId, { name: input.name, dataForms: input.dataForms, visibility: "private" })
    : await createSite(env, auth, { name: input.name, visibility: "private", dataForms: input.dataForms });
  const deployed = await deploySite(env, auth, site.id, { files: { "index.html": { content: input.html, encoding: "utf8" } } });
  return deployed.site;
}

/** The view's HTML from its live deployment. */
export async function getViewHtml(env: Env, auth: Auth, siteId: string) {
  const row = await siteRow(env, auth, siteId);
  if (!row.active_deployment) throw notFound("Deployment");
  const obj = await env.FILES.get(`sites/${siteId}/${row.active_deployment}/index.html`);
  if (!obj) throw notFound("index.html");
  return { site: await toSite(env, row), html: await obj.text() };
}
