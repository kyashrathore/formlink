import type { Env } from "@/env";
import { sha256, signToken, verifyToken } from "@/lib/crypto";
import { ApiError, badRequest, notFound } from "@/lib/errors";
import { newId, now } from "@/lib/ids";
import type { Form } from "@/services/forms";
import { runHook } from "@/services/hooks";

const CODE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_TARGET = 5;

export interface VerifiedClaim {
  channel: "email" | "sms";
  target: string;
}

function normalize(channel: "email" | "sms", to: string) {
  const v = to.trim();
  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw badRequest("Invalid email address");
    return v.toLowerCase();
  }
  const phone = v.replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw badRequest("Phone numbers must be in E.164 format, like +14155550100");
  return phone;
}

/** Generates a code and hands it to the form's `sendVerification` hook, which delivers it. */
export async function startVerification(env: Env, form: Form, channel: "email" | "sms", to: string) {
  const target = normalize(channel, to);
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM verifications WHERE form_id = ? AND target = ? AND expires_at > ?",
  )
    .bind(form.id, target, now() - CODE_TTL_MS)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_SENDS_PER_TARGET) throw new ApiError(429, "rate_limited", "Too many codes sent; try later");

  const id = newId("ver");
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, "0");
  const sent = await runHook(env, form, "sendVerification", { channel, to: target, code });
  if (!sent.handled)
    throw new ApiError(501, "not_configured", "This form has no sendVerification hook to deliver codes");
  if (sent.error) throw new ApiError(502, "delivery_failed", "The sendVerification hook failed", { error: sent.error });

  await env.DB.prepare(
    "INSERT INTO verifications (id, form_id, channel, target, code_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, form.id, channel, target, await sha256(`${id}:${code}`), now() + CODE_TTL_MS)
    .run();
  return { id, expiresAt: now() + CODE_TTL_MS };
}

/** Checks a code; on success returns a token the app sends with its submission. */
export async function checkVerification(env: Env, form: Form, id: string, code: string) {
  const row = await env.DB.prepare("SELECT * FROM verifications WHERE id = ? AND form_id = ?")
    .bind(id, form.id)
    .first<{ id: string; channel: "email" | "sms"; target: string; code_hash: string; attempts: number; expires_at: number }>();
  if (!row || row.expires_at < now()) throw notFound("Verification");
  if (row.attempts >= MAX_ATTEMPTS) throw new ApiError(429, "rate_limited", "Too many attempts; request a new code");
  await env.DB.prepare("UPDATE verifications SET attempts = attempts + 1 WHERE id = ?").bind(id).run();
  if ((await sha256(`${id}:${code.trim()}`)) !== row.code_hash) throw badRequest("Incorrect code");
  await env.DB.prepare("UPDATE verifications SET verified_at = ? WHERE id = ?").bind(now(), id).run();
  const token = await signToken(env.SIGNING_KEY, {
    v: form.id,
    channel: row.channel,
    target: row.target,
    exp: now() + TOKEN_TTL_MS,
  });
  return { token, channel: row.channel, target: row.target };
}

export async function readVerificationToken(env: Env, form: Form, token: string): Promise<VerifiedClaim | null> {
  const p = await verifyToken<{ v: string; channel: "email" | "sms"; target: string; exp: number }>(
    env.SIGNING_KEY,
    token,
  );
  if (!p || p.v !== form.id) return null;
  return { channel: p.channel, target: p.target };
}
