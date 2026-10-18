import type { Auth, Env } from "@/env";
import { sha256 } from "@/lib/crypto";
import { ApiError, forbidden, notFound, unauthorized } from "@/lib/errors";
import { newId, now, randomString } from "@/lib/ids";

export interface ApiKeyRow {
  id: string;
  workspace_id: string;
  name: string;
  role: "admin" | "read";
  prefix: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

const KEY_PREFIX = "fl_sk_";

export const isApiKey = (token: string) => token.startsWith(KEY_PREFIX);

export function requireAdmin(auth: Auth) {
  if (auth.role !== "admin") throw forbidden("This key is read-only");
}

export async function createWorkspace(env: Env, name: string) {
  const workspaceId = newId("ws");
  await env.DB.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)")
    .bind(workspaceId, name, now())
    .run();
  const key = await createKey(env, workspaceId, "owner", "admin");
  return { workspace: { id: workspaceId, name }, key };
}

export async function getWorkspace(env: Env, workspaceId: string) {
  const ws = await env.DB.prepare("SELECT id, name, created_at FROM workspaces WHERE id = ?")
    .bind(workspaceId)
    .first<{ id: string; name: string; created_at: number }>();
  if (!ws) throw notFound("Workspace");
  return ws;
}

/** Returns the plaintext key once; only its hash is stored. */
export async function createKey(env: Env, workspaceId: string, name: string, role: "admin" | "read") {
  const secret = KEY_PREFIX + randomString(32);
  const id = newId("key");
  await env.DB.prepare(
    "INSERT INTO api_keys (id, workspace_id, name, role, hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, workspaceId, name, role, await sha256(secret), secret.slice(0, 10), now())
    .run();
  return { id, name, role, secret };
}

export async function listKeys(env: Env, workspaceId: string) {
  const { results } = await env.DB.prepare(
    "SELECT id, workspace_id, name, role, prefix, created_at, last_used_at, revoked_at FROM api_keys WHERE workspace_id = ? ORDER BY created_at",
  )
    .bind(workspaceId)
    .all<ApiKeyRow>();
  return results;
}

export async function revokeKey(env: Env, auth: Auth, keyId: string) {
  if (keyId === auth.keyId) throw new ApiError(409, "conflict", "A key cannot revoke itself");
  const res = await env.DB.prepare(
    "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL",
  )
    .bind(now(), keyId, auth.workspaceId)
    .run();
  if (!res.meta.changes) throw notFound("Key");
}

export async function authenticateKey(env: Env, token: string): Promise<Auth> {
  if (!isApiKey(token)) throw unauthorized();
  const row = await env.DB.prepare(
    "SELECT id, workspace_id, role, last_used_at FROM api_keys WHERE hash = ? AND revoked_at IS NULL",
  )
    .bind(await sha256(token))
    .first<{ id: string; workspace_id: string; role: "admin" | "read"; last_used_at: number | null }>();
  if (!row) throw unauthorized();
  // Throttle last_used_at writes to once a minute.
  if (!row.last_used_at || now() - row.last_used_at > 60_000) {
    await env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(now(), row.id).run();
  }
  return { workspaceId: row.workspace_id, role: row.role, keyId: row.id };
}
