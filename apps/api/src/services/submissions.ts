import { z } from "zod";
import type { Auth, Env } from "@/env";
import { ApiError, badRequest, notFound } from "@/lib/errors";
import { newId, now } from "@/lib/ids";
import { parseJson } from "@/lib/json";
import { deleteFilesWhere, filesForSubmission } from "@/services/files";
import { type Form, getForm, getFormById, isOpen } from "@/services/forms";
import { runHook } from "@/services/hooks";
import { verifyPayment } from "@/services/payments";
import { getSecret } from "@/services/secrets";
import { readVerificationToken } from "@/services/verify";

export type Background = (p: Promise<unknown>) => void;

const MAX_DATA_BYTES = 512 * 1024;
const STATUS = /^[a-z][a-z0-9_-]{0,31}$/;

const Data = z.record(z.string(), z.unknown());

export const SubmitInput = z.object({
  data: Data,
  /** Stable id for one respondent's attempt. Links drafts, uploads, payments and events. */
  sessionId: z.string().min(8).max(64).optional(),
  /** Client context such as UTM params, hidden fields and the page URL. */
  meta: z.record(z.string(), z.unknown()).optional(),
  turnstileToken: z.string().optional(),
  verificationToken: z.string().optional(),
  paymentIntentId: z.string().optional(),
});
export type SubmitInput = z.infer<typeof SubmitInput>;

export const DraftInput = z.object({ data: Data, meta: z.record(z.string(), z.unknown()).optional() });

export const UpdateSubmissionInput = z.object({
  status: z.string().regex(STATUS).optional(),
  /** Shallow-merged into the existing data. */
  data: Data.optional(),
  /** Shallow-merged into the existing computed values. */
  computed: Data.optional(),
});

export interface RequestInfo {
  origin?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  country?: string | null;
  ip?: string | null;
}

interface SubmissionRow {
  id: string;
  form_id: string;
  workspace_id: string;
  session_id: string | null;
  status: string;
  data: string;
  computed: string;
  meta: string;
  verified: string | null;
  payment: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

function toSubmission(r: SubmissionRow) {
  return {
    id: r.id,
    formId: r.form_id,
    sessionId: r.session_id,
    status: r.status,
    data: parseJson<Record<string, unknown>>(r.data, {}),
    computed: parseJson<Record<string, unknown>>(r.computed, {}),
    meta: parseJson<Record<string, unknown>>(r.meta, {}),
    verified: parseJson<unknown>(r.verified, null),
    payment: parseJson<unknown>(r.payment, null),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  };
}
export type Submission = ReturnType<typeof toSubmission>;

function checkSize(data: unknown) {
  if (JSON.stringify(data).length > MAX_DATA_BYTES) throw new ApiError(413, "too_large", "Submission data is limited to 512KB");
}

function buildMeta(client: Record<string, unknown> | undefined, req: RequestInfo) {
  const clientJson = client ? JSON.stringify(client) : "";
  if (clientJson.length > 16 * 1024) throw badRequest("meta is limited to 16KB");
  return {
    ...(client ?? {}),
    $origin: req.origin ?? null,
    $referer: req.referer ?? null,
    $userAgent: req.userAgent ?? null,
    $country: req.country ?? null,
  };
}

async function bySession(env: Env, formId: string, sessionId: string) {
  return env.DB.prepare("SELECT * FROM submissions WHERE form_id = ? AND session_id = ?")
    .bind(formId, sessionId)
    .first<SubmissionRow>();
}

async function completeCount(env: Env, formId: string) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions WHERE form_id = ? AND completed_at IS NOT NULL")
    .bind(formId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

export async function checkTurnstile(env: Env, form: Form, token: string | undefined, ip?: string | null) {
  if (!form.settings.turnstile) return;
  if (!token) throw badRequest("turnstileToken is required");
  const secret = await getSecret(env, form.workspaceId, "TURNSTILE_SECRET_KEY");
  if (!secret) throw new ApiError(501, "not_configured", "Set the TURNSTILE_SECRET_KEY secret to use Turnstile");
  const res = await fetch(env.TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  const out = (await res.json()) as { success: boolean };
  if (!out.success) throw new ApiError(403, "turnstile_failed", "Turnstile check failed");
}

/** Saves partial answers for a session so drop-offs are captured. */
export async function saveDraft(
  env: Env,
  form: Form,
  sessionId: string,
  input: z.infer<typeof DraftInput>,
  req: RequestInfo,
) {
  if (!isOpen(form)) throw new ApiError(410, "closed", "This form is closed");
  checkSize(input.data);
  const existing = await bySession(env, form.id, sessionId);
  if (existing?.completed_at) throw new ApiError(409, "already_submitted", "This session already submitted");
  const t = now();
  const meta = JSON.stringify(buildMeta(input.meta, req));
  if (existing) {
    await env.DB.prepare("UPDATE submissions SET data = ?, meta = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(input.data), meta, t, existing.id)
      .run();
    return { id: existing.id, status: "draft" };
  }
  const id = newId("sub");
  await env.DB.prepare(
    "INSERT INTO submissions (id, form_id, workspace_id, session_id, status, data, meta, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)",
  )
    .bind(id, form.id, form.workspaceId, sessionId, JSON.stringify(input.data), meta, t, t)
    .run();
  return { id, status: "draft" };
}

/** Accepts a complete submission after the form's server-side checks and `beforeSubmit` hook. */
export async function submit(env: Env, form: Form, input: SubmitInput, req: RequestInfo, background: Background) {
  if (!isOpen(form, form.settings.maxSubmissions ? await completeCount(env, form.id) : undefined))
    throw new ApiError(410, "closed", "This form is closed");
  checkSize(input.data);
  await checkTurnstile(env, form, input.turnstileToken, req.ip);

  let verified = null;
  if (form.settings.verification) {
    verified = input.verificationToken ? await readVerificationToken(env, form, input.verificationToken) : null;
    if (!verified || verified.channel !== form.settings.verification)
      throw new ApiError(403, "verification_required", `A verified ${form.settings.verification} is required`);
  }

  let payment: Awaited<ReturnType<typeof verifyPayment>> | null = null;
  if (form.settings.payment) {
    if (!input.paymentIntentId || !input.sessionId)
      throw new ApiError(402, "payment_required", "paymentIntentId and sessionId are required");
    payment = await verifyPayment(env, form, input.paymentIntentId, input.sessionId, input.data);
  }

  const existing = input.sessionId ? await bySession(env, form.id, input.sessionId) : null;
  if (existing?.completed_at) throw new ApiError(409, "already_submitted", "This session already submitted");
  const id = existing?.id ?? newId("sub");
  const meta = buildMeta(input.meta, req);

  let status = "complete";
  let computed: Record<string, unknown> = {};
  const before = await runHook<{ errors?: Record<string, string>; computed?: Record<string, unknown>; status?: string }>(
    env,
    form,
    "beforeSubmit",
    { submission: { id, sessionId: input.sessionId ?? null, data: input.data, meta, verified, payment } },
    id,
  );
  if (before.error) throw new ApiError(422, "rejected", firstLine(before.error));
  if (before.result?.errors && Object.keys(before.result.errors).length)
    throw new ApiError(422, "invalid", "Submission rejected", { errors: before.result.errors });
  if (before.result?.computed) computed = before.result.computed;
  if (before.result?.status && STATUS.test(before.result.status)) status = before.result.status;
  // Delayed payment methods (bank debits) are still processing: hold the submission until Stripe's webhook.
  const awaitingPayment = payment?.status === "processing";
  if (awaitingPayment && payment) {
    payment = { ...payment, heldStatus: status };
    status = PENDING_PAYMENT;
  }

  const t = now();
  const values = [
    status,
    JSON.stringify(input.data),
    JSON.stringify(computed),
    JSON.stringify(meta),
    verified ? JSON.stringify(verified) : null,
    payment ? JSON.stringify(payment) : null,
  ];
  if (existing) {
    await env.DB.prepare(
      "UPDATE submissions SET status = ?, data = ?, computed = ?, meta = ?, verified = ?, payment = ?, updated_at = ?, completed_at = ? WHERE id = ?",
    )
      .bind(...values, t, t, id)
      .run();
  } else {
    await env.DB.prepare(
      "INSERT INTO submissions (id, form_id, workspace_id, session_id, status, data, computed, meta, verified, payment, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, form.id, form.workspaceId, input.sessionId ?? null, ...values, t, t, t)
      .run();
  }
  if (input.sessionId) {
    await env.DB.batch([
      env.DB.prepare("UPDATE files SET submission_id = ? WHERE form_id = ? AND session_id = ? AND submission_id IS NULL").bind(
        id,
        form.id,
        input.sessionId,
      ),
      env.DB.prepare("INSERT INTO events (form_id, session_id, type, created_at) VALUES (?, ?, 'complete', ?)").bind(
        form.id,
        input.sessionId,
        t,
      ),
    ]);
  }

  if (!awaitingPayment) background(runSideEffect(env, form, id, "afterSubmit", {}));
  return { id, status, computed };
}

export const PENDING_PAYMENT = "pending_payment";

/**
 * Settles a submission held for a delayed payment. On success it takes the status it would have had
 * and afterSubmit runs; on failure it becomes `payment_failed` and onStatusChange runs.
 */
export async function settlePayment(env: Env, workspaceId: string, paymentIntentId: string, outcome: "succeeded" | "failed") {
  const row = await env.DB.prepare(
    "SELECT * FROM submissions WHERE workspace_id = ? AND json_extract(payment, '$.id') = ?",
  )
    .bind(workspaceId, paymentIntentId)
    .first<SubmissionRow>();
  if (!row) return { matched: false };
  const s = toSubmission(row);
  const payment = s.payment as { heldStatus?: string; status: string; amount: number } | null;
  if (s.status !== PENDING_PAYMENT || !payment) return { matched: true, changed: false };
  const form = await getFormById(env, s.formId);
  const status = outcome === "succeeded" ? (payment.heldStatus ?? "complete") : "payment_failed";
  const { heldStatus: _held, ...rest } = payment;
  await env.DB.prepare("UPDATE submissions SET status = ?, payment = ?, updated_at = ? WHERE id = ?")
    .bind(status, JSON.stringify({ ...rest, status: outcome }), now(), s.id)
    .run();
  if (outcome === "succeeded") await runSideEffect(env, form, s.id, "afterSubmit", {});
  else await runSideEffect(env, form, s.id, "onStatusChange", { previousStatus: PENDING_PAYMENT });
  return { matched: true, changed: true, status };
}

/** Retry delays after a failed side-effect hook: 1m, 5m, 30m, 2h, 12h, then give up. */
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];

type SideEffect = "afterSubmit" | "onStatusChange";

/**
 * Runs a side-effect hook for a submission and applies its patch. A failure is scheduled for retry;
 * hooks get `attempt` (1-based) so they can stay idempotent.
 */
async function runSideEffect(
  env: Env,
  form: Form,
  submissionId: string,
  event: SideEffect,
  extra: Record<string, unknown>,
  attempt = 1,
) {
  const row = await env.DB.prepare("SELECT * FROM submissions WHERE id = ?").bind(submissionId).first<SubmissionRow>();
  if (!row) return { ok: true };
  const submission = toSubmission(row);
  const res = await runHook<{ computed?: Record<string, unknown>; status?: string }>(
    env,
    form,
    event,
    { submission: await withFiles(env, submission), ...extra, attempt },
    submissionId,
  );
  if (res.error) {
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay !== undefined)
      await env.DB.prepare(
        "INSERT INTO hook_retries (id, form_id, submission_id, event, extra, attempt, next_at, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(newId("run"), form.id, submissionId, event, JSON.stringify(extra), attempt + 1, now() + delay, res.error.slice(0, 2000))
        .run();
    return { ok: false, error: res.error };
  }
  if (res.result) await applyPatch(env, submission, res.result);
  return { ok: true };
}

/** Called by the cron: re-runs failed side-effect hooks that are due. */
export async function processHookRetries(env: Env, limit = 50) {
  const { results } = await env.DB.prepare("SELECT * FROM hook_retries WHERE next_at <= ? ORDER BY next_at LIMIT ?")
    .bind(now(), limit)
    .all<{ id: string; form_id: string; submission_id: string; event: SideEffect; extra: string; attempt: number }>();
  let succeeded = 0;
  for (const r of results) {
    await env.DB.prepare("DELETE FROM hook_retries WHERE id = ?").bind(r.id).run();
    const form = await getFormById(env, r.form_id).catch(() => null);
    if (!form) continue;
    const out = await runSideEffect(env, form, r.submission_id, r.event, parseJson(r.extra, {}), r.attempt);
    if (out.ok) succeeded++;
  }
  return { due: results.length, succeeded };
}

async function applyPatch(env: Env, s: Submission, patch: { computed?: Record<string, unknown>; status?: string }) {
  const status = patch.status && STATUS.test(patch.status) ? patch.status : s.status;
  const computed = patch.computed ? { ...s.computed, ...patch.computed } : s.computed;
  if (status === s.status && computed === s.computed) return;
  await env.DB.prepare("UPDATE submissions SET status = ?, computed = ?, updated_at = ? WHERE id = ?")
    .bind(status, JSON.stringify(computed), now(), s.id)
    .run();
}

const firstLine = (s: string) => s.split("\n")[0]!.replace(/^Error: /, "").slice(0, 500);

async function loadSubmission(env: Env, id: string) {
  const row = await env.DB.prepare("SELECT * FROM submissions WHERE id = ?").bind(id).first<SubmissionRow>();
  if (!row) throw notFound("Submission");
  return toSubmission(row);
}

async function withFiles(env: Env, s: Submission) {
  return { ...s, files: await filesForSubmission(env, s.id) };
}

export const ListQuery = z.object({
  status: z.string().optional(),
  /** Include drafts (partial submissions). Off by default. */
  drafts: z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]).optional(),
  since: z.coerce.number().int().optional(),
  until: z.coerce.number().int().optional(),
  /** Case-insensitive text match anywhere in the answers. */
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  cursor: z.string().optional(),
});

export async function listSubmissions(env: Env, auth: Auth, formId: string, query: z.infer<typeof ListQuery>) {
  await getForm(env, auth, formId);
  const where = ["form_id = ?"];
  const binds: unknown[] = [formId];
  if (query.status) {
    where.push("status = ?");
    binds.push(query.status);
  } else if (!query.drafts) {
    where.push("status != 'draft'");
  }
  if (query.since) where.push("created_at >= ?"), binds.push(query.since);
  if (query.until) where.push("created_at <= ?"), binds.push(query.until);
  if (query.q) where.push("data LIKE ?"), binds.push(`%${query.q.replace(/[%_]/g, "")}%`);
  if (query.cursor) {
    const [t, id] = query.cursor.split(":");
    where.push("(created_at < ? OR (created_at = ? AND id < ?))");
    binds.push(Number(t), Number(t), id);
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM submissions WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`,
  )
    .bind(...binds, query.limit + 1)
    .all<SubmissionRow>();
  const page = results.slice(0, query.limit);
  const last = page.at(-1);
  return {
    submissions: page.map(toSubmission),
    nextCursor: results.length > query.limit && last ? `${last.created_at}:${last.id}` : null,
  };
}

export async function getSubmission(env: Env, auth: Auth, id: string) {
  const s = await loadSubmission(env, id);
  await getForm(env, auth, s.formId);
  return withFiles(env, s);
}

export async function updateSubmission(
  env: Env,
  auth: Auth,
  id: string,
  input: z.infer<typeof UpdateSubmissionInput>,
  background: Background,
) {
  const s = await loadSubmission(env, id);
  const form = await getForm(env, auth, s.formId);
  const data = input.data ? { ...s.data, ...input.data } : s.data;
  const computed = input.computed ? { ...s.computed, ...input.computed } : s.computed;
  const status = input.status ?? s.status;
  await env.DB.prepare("UPDATE submissions SET status = ?, data = ?, computed = ?, updated_at = ? WHERE id = ?")
    .bind(status, JSON.stringify(data), JSON.stringify(computed), now(), id)
    .run();
  const updated = await loadSubmission(env, id);
  if (status !== s.status) {
    background(runSideEffect(env, form, id, "onStatusChange", { previousStatus: s.status }));
  }
  return updated;
}

export async function deleteSubmission(env: Env, auth: Auth, id: string) {
  const s = await loadSubmission(env, id);
  await getForm(env, auth, s.formId);
  await deleteFilesWhere(env, "submission_id = ?", id);
  await env.DB.prepare("DELETE FROM submissions WHERE id = ?").bind(id).run();
}

/** All non-draft submissions as CSV (answers flattened to columns) or JSON. */
export async function exportSubmissions(env: Env, auth: Auth, formId: string, format: "csv" | "json") {
  await getForm(env, auth, formId);
  const all: Submission[] = [];
  let cursor: string | undefined;
  do {
    const page = await listSubmissions(env, auth, formId, { limit: 500, cursor });
    all.push(...page.submissions);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && all.length < 50_000);
  if (format === "json") return JSON.stringify(all);

  const dataKeys = [...new Set(all.flatMap((s) => Object.keys(s.data)))];
  const computedKeys = [...new Set(all.flatMap((s) => Object.keys(s.computed)))];
  const header = ["id", "status", "created_at", "completed_at", ...dataKeys, ...computedKeys.map((k) => `computed.${k}`)];
  const cell = (v: unknown) => {
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = all.map((s) =>
    [
      s.id,
      s.status,
      new Date(s.createdAt).toISOString(),
      s.completedAt ? new Date(s.completedAt).toISOString() : "",
      ...dataKeys.map((k) => s.data[k]),
      ...computedKeys.map((k) => s.computed[k]),
    ]
      .map(cell)
      .join(","),
  );
  return [header.map(cell).join(","), ...rows].join("\n");
}
