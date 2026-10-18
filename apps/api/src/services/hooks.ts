import type { Auth, Env } from "@/env";
import { badRequest, notFound } from "@/lib/errors";
import { newId, now } from "@/lib/ids";
import { parseJson } from "@/lib/json";
import { type Form, getForm } from "@/services/forms";
import { loadSecrets } from "@/services/secrets";

/**
 * Hooks are ES modules written by the user's AI, one per form, run in a sandboxed Dynamic Worker.
 * Every export is optional:
 *
 *   export default {
 *     async beforeSubmit({ submission, form }, ctx) {}  // throw or return { errors } to reject; { computed, status } to augment
 *     async afterSubmit({ submission, form }, ctx) {}   // side effects (webhooks, email, CRM); may return { computed, status }
 *     async onStatusChange({ submission, form, previousStatus }, ctx) {}
 *     async price({ data, form }, ctx) {}               // -> { amount, currency, description? } for Stripe
 *     async sendVerification({ channel, to, code, form }, ctx) {} // deliver an OTP
 *   }
 *
 * `ctx.secrets` holds the workspace secrets; `fetch` is available for outbound calls.
 */
export const HOOK_EVENTS = ["beforeSubmit", "afterSubmit", "onStatusChange", "price", "sendVerification"] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

const MAX_CODE_BYTES = 256 * 1024;
const HOOK_TIMEOUT_MS = 30_000;

const WRAPPER = `import hook from "./hook.js";
const fmt = (a) => { if (typeof a === "string") return a; try { return JSON.stringify(a); } catch { return String(a); } };
export default {
  async fetch(request, env) {
    const { name, event } = await request.json();
    const logs = [];
    const push = (level) => (...args) => { if (logs.length < 200) logs.push("[" + level + "] " + args.map(fmt).join(" ").slice(0, 2000)); };
    console.log = push("log"); console.info = push("info"); console.warn = push("warn"); console.error = push("error");
    const fn = hook && hook[name];
    if (name === "__load") return Response.json({ handled: true, result: Object.keys(hook || {}), logs });
    if (typeof fn !== "function") return Response.json({ handled: false, logs });
    const ctx = { secrets: env.SECRETS, log: push("log") };
    try {
      const result = await fn.call(hook, event, ctx);
      return Response.json({ handled: true, result: result === undefined ? null : result, logs });
    } catch (err) {
      return Response.json({ handled: true, error: err && err.stack ? String(err.stack) : String(err), logs });
    }
  },
};
`;

export interface HookResult<T = unknown> {
  handled: boolean;
  result?: T;
  error?: string;
  logs: string[];
}

async function getHookCode(env: Env, formId: string, version: number) {
  const row = await env.DB.prepare("SELECT code FROM form_hooks WHERE form_id = ? AND version = ?")
    .bind(formId, version)
    .first<{ code: string }>();
  return row?.code ?? null;
}

async function execute(
  env: Env,
  form: Form,
  cacheKey: string | null,
  code: string,
  name: string,
  event: unknown,
): Promise<HookResult> {
  const secrets = await loadSecrets(env, form.workspaceId);
  const worker = env.LOADER.get(cacheKey ? `${cacheKey}:${secrets.stamp}` : null, () => ({
    compatibilityDate: "2026-10-01",
    mainModule: "main.js",
    modules: { "main.js": WRAPPER, "hook.js": code },
    env: { SECRETS: secrets.values },
  }));
  const run = worker.getEntrypoint().fetch("https://hook.internal/", {
    method: "POST",
    body: JSON.stringify({ name, event }),
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Hook timed out after ${HOOK_TIMEOUT_MS}ms`)), HOOK_TIMEOUT_MS),
  );
  try {
    const res = await Promise.race([run, timeout]);
    return (await res.json()) as HookResult;
  } catch (err) {
    // Syntax errors and module load failures surface here.
    return { handled: true, error: err instanceof Error ? err.message : String(err), logs: [] };
  }
}

/** Runs the form's active hook for `name`. Records a hook run when the hook handled the event. */
export async function runHook<T = unknown>(
  env: Env,
  form: Form,
  name: HookEvent,
  event: Record<string, unknown>,
  submissionId?: string,
): Promise<HookResult<T>> {
  if (!form.hookVersion) return { handled: false, logs: [] };
  const code = await getHookCode(env, form.id, form.hookVersion);
  if (!code) return { handled: false, logs: [] };
  const started = now();
  const res = await execute(env, form, `${form.id}:v${form.hookVersion}`, code, name, { ...event, form: hookForm(form) });
  if (res.handled) {
    await env.DB.prepare(
      "INSERT INTO hook_runs (id, form_id, submission_id, event, version, ok, error, logs, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        newId("run"),
        form.id,
        submissionId ?? null,
        name,
        form.hookVersion,
        res.error ? 0 : 1,
        res.error ?? null,
        JSON.stringify(res.logs),
        now() - started,
        now(),
      )
      .run();
  }
  return res as HookResult<T>;
}

const hookForm = (form: Form) => ({ id: form.id, name: form.name, settings: form.settings });

export async function getHook(env: Env, auth: Auth, formId: string) {
  const form = await getForm(env, auth, formId);
  if (!form.hookVersion) return { formId, version: null, code: null };
  return { formId, version: form.hookVersion, code: await getHookCode(env, formId, form.hookVersion) };
}

/** Saves a new hook version after checking it loads. Pass an empty string to remove the hook. */
export async function setHook(env: Env, auth: Auth, formId: string, code: string) {
  const form = await getForm(env, auth, formId);
  if (!code.trim()) {
    await env.DB.prepare("UPDATE forms SET hook_version = NULL, updated_at = ? WHERE id = ?").bind(now(), formId).run();
    return { formId, version: null, exports: [] };
  }
  if (code.length > MAX_CODE_BYTES) throw badRequest("Hook code is limited to 256KB");
  const loaded = await execute(env, form, null, code, "__load", {});
  if (loaded.error) throw badRequest("Hook failed to load", { error: loaded.error });
  const exports = (loaded.result as string[]) ?? [];
  const unknown = exports.filter((e) => !(HOOK_EVENTS as readonly string[]).includes(e));
  const latest = await env.DB.prepare("SELECT MAX(version) AS v FROM form_hooks WHERE form_id = ?")
    .bind(formId)
    .first<{ v: number | null }>();
  const version = (latest?.v ?? 0) + 1;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO form_hooks (form_id, version, code, created_at) VALUES (?, ?, ?, ?)").bind(
      formId,
      version,
      code,
      now(),
    ),
    env.DB.prepare("UPDATE forms SET hook_version = ?, updated_at = ? WHERE id = ?").bind(version, now(), formId),
  ]);
  return {
    formId,
    version,
    exports,
    warnings: unknown.length ? [`Unknown exports ignored: ${unknown.join(", ")}`] : [],
  };
}

/** Runs a hook event against sample input without storing anything. `code` overrides the saved hook. */
export async function testHook(
  env: Env,
  auth: Auth,
  formId: string,
  name: HookEvent,
  event: Record<string, unknown>,
  code?: string,
) {
  const form = await getForm(env, auth, formId);
  const source = code ?? (form.hookVersion ? await getHookCode(env, formId, form.hookVersion) : null);
  if (!source) throw notFound("Hook");
  return execute(env, form, null, source, name, { ...event, form: hookForm(form) });
}

export async function listHookRuns(env: Env, auth: Auth, formId: string, limit = 20) {
  await getForm(env, auth, formId);
  const { results } = await env.DB.prepare(
    "SELECT * FROM hook_runs WHERE form_id = ? ORDER BY created_at DESC LIMIT ?",
  )
    .bind(formId, Math.min(limit, 100))
    .all<{
      id: string;
      submission_id: string | null;
      event: string;
      version: number;
      ok: number;
      error: string | null;
      logs: string;
      duration_ms: number;
      created_at: number;
    }>();
  return results.map((r) => ({
    id: r.id,
    submissionId: r.submission_id,
    event: r.event,
    version: r.version,
    ok: !!r.ok,
    error: r.error,
    logs: parseJson<string[]>(r.logs, []),
    durationMs: r.duration_ms,
    createdAt: r.created_at,
  }));
}
