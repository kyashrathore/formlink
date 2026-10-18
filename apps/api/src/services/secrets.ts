import type { Auth, Env } from "@/env";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { badRequest, notFound } from "@/lib/errors";
import { now } from "@/lib/ids";

const NAME = /^[A-Z][A-Z0-9_]{0,63}$/;

export async function setSecret(env: Env, auth: Auth, name: string, value: string) {
  if (!NAME.test(name)) throw badRequest("Secret names are UPPER_SNAKE_CASE, up to 64 chars");
  if (value.length > 8192) throw badRequest("Secret values are limited to 8KB");
  const { ciphertext, iv } = await encryptSecret(env.SECRETS_KEY, value);
  await env.DB.prepare(
    `INSERT INTO secrets (workspace_id, name, ciphertext, iv, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id, name) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, updated_at = excluded.updated_at`,
  )
    .bind(auth.workspaceId, name, ciphertext, iv, now())
    .run();
}

export async function listSecretNames(env: Env, workspaceId: string) {
  const { results } = await env.DB.prepare(
    "SELECT name, updated_at FROM secrets WHERE workspace_id = ? ORDER BY name",
  )
    .bind(workspaceId)
    .all<{ name: string; updated_at: number }>();
  return results.map((r) => ({ name: r.name, updatedAt: r.updated_at }));
}

export async function deleteSecret(env: Env, auth: Auth, name: string) {
  const res = await env.DB.prepare("DELETE FROM secrets WHERE workspace_id = ? AND name = ?")
    .bind(auth.workspaceId, name)
    .run();
  if (!res.meta.changes) throw notFound("Secret");
}

/** Decrypted secrets plus a version stamp (changes whenever any secret changes). */
export async function loadSecrets(env: Env, workspaceId: string) {
  const { results } = await env.DB.prepare(
    "SELECT name, ciphertext, iv, updated_at FROM secrets WHERE workspace_id = ?",
  )
    .bind(workspaceId)
    .all<{ name: string; ciphertext: string; iv: string; updated_at: number }>();
  const values: Record<string, string> = {};
  let stamp = 0;
  for (const r of results) {
    values[r.name] = await decryptSecret(env.SECRETS_KEY, r.ciphertext, r.iv);
    stamp = Math.max(stamp, r.updated_at);
  }
  return { values, stamp: `${results.length}-${stamp}` };
}

export async function getSecret(env: Env, workspaceId: string, name: string) {
  const r = await env.DB.prepare("SELECT ciphertext, iv FROM secrets WHERE workspace_id = ? AND name = ?")
    .bind(workspaceId, name)
    .first<{ ciphertext: string; iv: string }>();
  return r ? decryptSecret(env.SECRETS_KEY, r.ciphertext, r.iv) : null;
}
