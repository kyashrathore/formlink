import { z } from "zod";
import type { Auth, Env } from "@/env";
import { forbidden, notFound } from "@/lib/errors";
import { newId, now } from "@/lib/ids";
import { parseJson } from "@/lib/json";

/**
 * Server-side behaviour of a form. There is deliberately no field schema here:
 * rendering, questions and branching live in the user's own app.
 */
export const FormSettings = z.object({
  /** Origins allowed to submit from a browser. Empty means any origin. */
  allowedOrigins: z.array(z.string()).default([]),
  /** Require a Cloudflare Turnstile token on submit (secret TURNSTILE_SECRET_KEY). */
  turnstile: z.boolean().default(false),
  /** Delete submissions and their files after this many days. */
  retentionDays: z.number().int().positive().optional(),
  uploads: z
    .object({
      maxBytes: z.number().int().positive().max(100 * 1024 * 1024).default(10 * 1024 * 1024),
      /** MIME types or prefixes like "image/". Empty means any. */
      allowedTypes: z.array(z.string()).default([]),
    })
    .default({ maxBytes: 10 * 1024 * 1024, allowedTypes: [] }),
  /** Require a verified email or phone (OTP sent by the form's `sendVerification` hook). */
  verification: z.enum(["email", "sms"]).optional(),
  /** Require a succeeded Stripe PaymentIntent (secret STRIPE_SECRET_KEY, amount from the `price` hook). */
  payment: z.boolean().default(false),
  /** Stop accepting submissions after this many complete ones. */
  maxSubmissions: z.number().int().positive().optional(),
  /** Stop accepting submissions after this time (ms since epoch). */
  closesAt: z.number().int().optional(),
});
export type FormSettings = z.infer<typeof FormSettings>;

/** A settings patch: omitted keys keep their value, `null` resets a key to its default. */
export const SettingsPatch = z.object({
  allowedOrigins: z.array(z.string()).nullable().optional(),
  turnstile: z.boolean().nullable().optional(),
  retentionDays: z.number().int().positive().nullable().optional(),
  uploads: z
    .object({ maxBytes: z.number().int().positive().max(100 * 1024 * 1024).optional(), allowedTypes: z.array(z.string()).optional() })
    .nullable()
    .optional(),
  verification: z.enum(["email", "sms"]).nullable().optional(),
  payment: z.boolean().nullable().optional(),
  maxSubmissions: z.number().int().positive().nullable().optional(),
  closesAt: z.number().int().nullable().optional(),
});

function applySettingsPatch(current: FormSettings, patch: z.infer<typeof SettingsPatch> = {}) {
  const merged: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) delete merged[k];
    else merged[k] = k === "uploads" ? { ...current.uploads, ...(v as object) } : v;
  }
  return FormSettings.parse(merged);
}

export const FormInput = z.object({
  name: z.string().min(1).max(200),
  status: z.enum(["open", "closed"]).optional(),
  settings: SettingsPatch.optional(),
});

interface FormRow {
  id: string;
  workspace_id: string;
  name: string;
  status: "open" | "closed";
  settings: string;
  hook_version: number | null;
  created_at: number;
  updated_at: number;
}

export type Form = ReturnType<typeof toForm>;

function toForm(row: FormRow) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    status: row.status,
    settings: FormSettings.parse(parseJson(row.settings, {})),
    hookVersion: row.hook_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** What a browser may learn about a form. */
export function publicForm(form: Form) {
  const s = form.settings;
  return {
    id: form.id,
    name: form.name,
    open: isOpen(form),
    turnstile: s.turnstile,
    verification: s.verification ?? null,
    payment: s.payment,
    uploads: s.uploads,
  };
}

export function isOpen(form: Form, completeCount?: number) {
  if (form.status !== "open") return false;
  if (form.settings.closesAt && Date.now() > form.settings.closesAt) return false;
  if (form.settings.maxSubmissions && completeCount !== undefined && completeCount >= form.settings.maxSubmissions)
    return false;
  return true;
}

export function assertFormAccess(auth: Auth, formId: string) {
  if (auth.formIds && !auth.formIds.includes(formId)) throw forbidden("No access to this form");
}

export async function getFormById(env: Env, formId: string) {
  const row = await env.DB.prepare("SELECT * FROM forms WHERE id = ?").bind(formId).first<FormRow>();
  if (!row) throw notFound("Form");
  return toForm(row);
}

export async function getForm(env: Env, auth: Auth, formId: string) {
  assertFormAccess(auth, formId);
  const form = await getFormById(env, formId);
  if (form.workspaceId !== auth.workspaceId) throw notFound("Form");
  return form;
}

export async function listForms(env: Env, auth: Auth) {
  const { results } = await env.DB.prepare("SELECT * FROM forms WHERE workspace_id = ? ORDER BY created_at DESC")
    .bind(auth.workspaceId)
    .all<FormRow>();
  return results.map(toForm).filter((f) => !auth.formIds || auth.formIds.includes(f.id));
}

export async function createForm(env: Env, auth: Auth, input: z.infer<typeof FormInput>) {
  const id = newId("frm");
  const settings = applySettingsPatch(FormSettings.parse({}), input.settings);
  const t = now();
  await env.DB.prepare(
    "INSERT INTO forms (id, workspace_id, name, status, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, auth.workspaceId, input.name, input.status ?? "open", JSON.stringify(settings), t, t)
    .run();
  return getForm(env, auth, id);
}

export async function updateForm(env: Env, auth: Auth, formId: string, input: Partial<z.infer<typeof FormInput>>) {
  const form = await getForm(env, auth, formId);
  const settings = applySettingsPatch(form.settings, input.settings);
  await env.DB.prepare("UPDATE forms SET name = ?, status = ?, settings = ?, updated_at = ? WHERE id = ?")
    .bind(input.name ?? form.name, input.status ?? form.status, JSON.stringify(settings), now(), formId)
    .run();
  return getForm(env, auth, formId);
}

export async function deleteForm(env: Env, auth: Auth, formId: string) {
  await getForm(env, auth, formId);
  // R2 objects first; rows cascade.
  let cursor: string | undefined;
  do {
    const list = await env.FILES.list({ prefix: `forms/${formId}/`, cursor });
    if (list.objects.length) await env.FILES.delete(list.objects.map((o) => o.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  await env.DB.prepare("DELETE FROM forms WHERE id = ?").bind(formId).run();
}
