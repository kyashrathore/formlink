import { Hono } from "hono";
import { z } from "zod";
import { forbidden, unauthorized } from "@/lib/errors";
import { type AppEnv, background, body, parse } from "@/lib/http";
import { getAnalytics } from "@/services/events";
import { downloadFile } from "@/services/files";
import { FormInput, createForm, deleteForm, getForm, listForms, updateForm } from "@/services/forms";
import { HOOK_EVENTS, getHook, listHookRuns, setHook, testHook } from "@/services/hooks";
import { deleteSecret, listSecretNames, setSecret } from "@/services/secrets";
import {
  DeployInput,
  SiteInput,
  SiteUpdate,
  addDomain,
  createSite,
  deleteSite,
  deploySite,
  getDomain,
  getSite,
  listDeployments,
  listSites,
  removeDomain,
  rollbackSite,
  updateSite,
} from "@/services/sites";
import {
  ListQuery,
  UpdateSubmissionInput,
  deleteSubmission,
  exportSubmissions,
  getSubmission,
  listSubmissions,
  updateSubmission,
} from "@/services/submissions";
import {
  authenticateKey,
  createKey,
  createWorkspace,
  getWorkspace,
  listKeys,
  requireAdmin,
  revokeKey,
} from "@/services/workspaces";

export const admin = new Hono<AppEnv>();

// Workspace bootstrap is the only unauthenticated admin route.
admin.post("/workspaces", async (c) => {
  const input = await body(c, z.object({ name: z.string().min(1).max(200), signupToken: z.string().optional() }));
  if (c.env.SIGNUP_TOKEN && input.signupToken !== c.env.SIGNUP_TOKEN) throw forbidden("Signups need a valid signupToken");
  return c.json(await createWorkspace(c.env, input.name), 201);
});

// Files accept either an API key or a signed `token` query param.
admin.get("/files/:id", async (c) => {
  const token = c.req.query("token");
  const header = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = token ? undefined : header ? await authenticateKey(c.env, header) : (c.get("siteAuth") ?? undefined);
  return downloadFile(c.env, c.req.param("id"), { auth, token });
});

admin.use("*", async (c, next) => {
  const header = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = header ? await authenticateKey(c.env, header) : c.get("siteAuth");
  if (!auth) throw unauthorized();
  c.set("auth", auth);
  // Read-only callers may only use GET.
  if (auth.role === "read" && c.req.method !== "GET") throw forbidden("This key is read-only");
  await next();
});

admin.get("/me", async (c) => {
  const auth = c.get("auth");
  return c.json({ workspace: await getWorkspace(c.env, auth.workspaceId), role: auth.role });
});

// Keys (team access)
admin.get("/keys", async (c) => {
  requireAdmin(c.get("auth"));
  return c.json({ keys: await listKeys(c.env, c.get("auth").workspaceId) });
});
admin.post("/keys", async (c) => {
  const input = await body(c, z.object({ name: z.string().min(1).max(100), role: z.enum(["admin", "read"]).default("admin") }));
  return c.json(await createKey(c.env, c.get("auth").workspaceId, input.name, input.role), 201);
});
admin.delete("/keys/:id", async (c) => {
  await revokeKey(c.env, c.get("auth"), c.req.param("id"));
  return c.body(null, 204);
});

// Forms
admin.get("/forms", async (c) => c.json({ forms: await listForms(c.env, c.get("auth")) }));
admin.post("/forms", async (c) => c.json(await createForm(c.env, c.get("auth"), await body(c, FormInput)), 201));
admin.get("/forms/:id", async (c) => c.json(await getForm(c.env, c.get("auth"), c.req.param("id"))));
admin.patch("/forms/:id", async (c) =>
  c.json(await updateForm(c.env, c.get("auth"), c.req.param("id"), await body(c, FormInput.partial()))),
);
admin.delete("/forms/:id", async (c) => {
  await deleteForm(c.env, c.get("auth"), c.req.param("id"));
  return c.body(null, 204);
});

// Hooks
admin.get("/forms/:id/hook", async (c) => c.json(await getHook(c.env, c.get("auth"), c.req.param("id"))));
admin.put("/forms/:id/hook", async (c) => {
  const { code } = await body(c, z.object({ code: z.string() }));
  return c.json(await setHook(c.env, c.get("auth"), c.req.param("id"), code));
});
admin.post("/forms/:id/hook/test", async (c) => {
  const input = await body(
    c,
    z.object({ event: z.enum(HOOK_EVENTS), input: z.record(z.string(), z.unknown()).default({}), code: z.string().optional() }),
  );
  return c.json(await testHook(c.env, c.get("auth"), c.req.param("id"), input.event, input.input, input.code));
});
admin.get("/forms/:id/hook/runs", async (c) =>
  c.json({ runs: await listHookRuns(c.env, c.get("auth"), c.req.param("id"), Number(c.req.query("limit") ?? 20)) }),
);

// Submissions
admin.get("/forms/:id/submissions", async (c) =>
  c.json(await listSubmissions(c.env, c.get("auth"), c.req.param("id"), parse(ListQuery, c.req.query()))),
);
admin.get("/forms/:id/export", async (c) => {
  const format = c.req.query("format") === "json" ? "json" : "csv";
  const out = await exportSubmissions(c.env, c.get("auth"), c.req.param("id"), format);
  return c.body(out, 200, {
    "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/json",
    "content-disposition": `attachment; filename="${c.req.param("id")}.${format}"`,
  });
});
admin.get("/forms/:id/analytics", async (c) => {
  const q = parse(z.object({ since: z.coerce.number().optional(), until: z.coerce.number().optional() }), c.req.query());
  return c.json(await getAnalytics(c.env, c.get("auth"), c.req.param("id"), q));
});
admin.get("/submissions/:id", async (c) => c.json(await getSubmission(c.env, c.get("auth"), c.req.param("id"))));
admin.patch("/submissions/:id", async (c) =>
  c.json(
    await updateSubmission(c.env, c.get("auth"), c.req.param("id"), await body(c, UpdateSubmissionInput), background(c)),
  ),
);
admin.delete("/submissions/:id", async (c) => {
  await deleteSubmission(c.env, c.get("auth"), c.req.param("id"));
  return c.body(null, 204);
});

// Secrets
admin.get("/secrets", async (c) => c.json({ secrets: await listSecretNames(c.env, c.get("auth").workspaceId) }));
admin.put("/secrets/:name", async (c) => {
  const { value } = await body(c, z.object({ value: z.string() }));
  await setSecret(c.env, c.get("auth"), c.req.param("name"), value);
  return c.body(null, 204);
});
admin.delete("/secrets/:name", async (c) => {
  await deleteSecret(c.env, c.get("auth"), c.req.param("name"));
  return c.body(null, 204);
});

// Sites (hosting) and domains
admin.get("/sites", async (c) => c.json({ sites: await listSites(c.env, c.get("auth")) }));
admin.post("/sites", async (c) => c.json(await createSite(c.env, c.get("auth"), await body(c, SiteInput)), 201));
admin.get("/sites/:id", async (c) => c.json(await getSite(c.env, c.get("auth"), c.req.param("id"))));
admin.patch("/sites/:id", async (c) =>
  c.json(await updateSite(c.env, c.get("auth"), c.req.param("id"), await body(c, SiteUpdate))),
);
admin.delete("/sites/:id", async (c) => {
  await deleteSite(c.env, c.get("auth"), c.req.param("id"));
  return c.body(null, 204);
});
admin.post("/sites/:id/deployments", async (c) =>
  c.json(await deploySite(c.env, c.get("auth"), c.req.param("id"), await body(c, DeployInput)), 201),
);
admin.get("/sites/:id/deployments", async (c) =>
  c.json({ deployments: await listDeployments(c.env, c.get("auth"), c.req.param("id")) }),
);
admin.post("/sites/:id/rollback", async (c) => {
  const { deploymentId } = await body(c, z.object({ deploymentId: z.string() }));
  return c.json(await rollbackSite(c.env, c.get("auth"), c.req.param("id"), deploymentId));
});
admin.post("/sites/:id/domains", async (c) => {
  const { hostname } = await body(c, z.object({ hostname: z.string() }));
  return c.json(await addDomain(c.env, c.get("auth"), c.req.param("id"), hostname), 201);
});
admin.get("/domains/:hostname", async (c) => c.json(await getDomain(c.env, c.get("auth"), c.req.param("hostname"))));
admin.delete("/domains/:hostname", async (c) => {
  await removeDomain(c.env, c.get("auth"), c.req.param("hostname"));
  return c.body(null, 204);
});
