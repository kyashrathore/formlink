import type { Auth, Env } from "@/env";
import { signToken, verifyToken } from "@/lib/crypto";
import { ApiError, badRequest, notFound } from "@/lib/errors";
import { newId, now } from "@/lib/ids";
import { type Form, getForm } from "@/services/forms";

export interface FileRow {
  id: string;
  form_id: string;
  session_id: string | null;
  submission_id: string | null;
  r2_key: string;
  name: string;
  type: string;
  size: number;
  created_at: number;
}

const FILE_URL_TTL_MS = 7 * 24 * 3600 * 1000;

export async function uploadFile(
  env: Env,
  form: Form,
  input: { sessionId: string; name: string; type: string; size: number; body: ReadableStream },
) {
  const { maxBytes, allowedTypes } = form.settings.uploads;
  if (!input.size) throw badRequest("Content-Length is required");
  if (input.size > maxBytes) throw new ApiError(413, "too_large", `Files are limited to ${maxBytes} bytes`);
  if (allowedTypes.length && !allowedTypes.some((t) => (t.endsWith("/") ? input.type.startsWith(t) : input.type === t)))
    throw new ApiError(415, "unsupported_type", `File type ${input.type} is not allowed`);
  const id = newId("fil");
  const key = `forms/${form.id}/${id}`;
  await env.FILES.put(key, input.body, {
    httpMetadata: { contentType: input.type },
    customMetadata: { name: input.name },
  });
  await env.DB.prepare(
    "INSERT INTO files (id, form_id, session_id, r2_key, name, type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, form.id, input.sessionId, key, input.name, input.type, input.size, now())
    .run();
  return { id, name: input.name, type: input.type, size: input.size };
}

/** A time-limited download link, safe to hand to hooks, exports and views. */
export async function fileUrl(env: Env, fileId: string) {
  const token = await signToken(env.SIGNING_KEY, { f: fileId, exp: Date.now() + FILE_URL_TTL_MS });
  return `${env.PUBLIC_URL}/v1/files/${fileId}?token=${encodeURIComponent(token)}`;
}

export async function filesForSubmission(env: Env, submissionId: string) {
  const { results } = await env.DB.prepare("SELECT * FROM files WHERE submission_id = ? ORDER BY created_at")
    .bind(submissionId)
    .all<FileRow>();
  return Promise.all(
    results.map(async (f) => ({ id: f.id, name: f.name, type: f.type, size: f.size, url: await fileUrl(env, f.id) })),
  );
}

async function getFileRow(env: Env, fileId: string) {
  const row = await env.DB.prepare("SELECT * FROM files WHERE id = ?").bind(fileId).first<FileRow>();
  if (!row) throw notFound("File");
  return row;
}

/** Download with either an API key (auth) or a signed `token`. */
export async function downloadFile(env: Env, fileId: string, access: { auth?: Auth; token?: string }) {
  const row = await getFileRow(env, fileId);
  if (access.token) {
    const payload = await verifyToken<{ f: string; exp: number }>(env.SIGNING_KEY, access.token);
    if (!payload || payload.f !== fileId) throw notFound("File");
  } else if (access.auth) {
    await getForm(env, access.auth, row.form_id);
  } else {
    throw notFound("File");
  }
  const obj = await env.FILES.get(row.r2_key);
  if (!obj) throw notFound("File");
  return new Response(obj.body, {
    headers: {
      "content-type": row.type,
      "content-length": String(row.size),
      "content-disposition": `inline; filename="${row.name.replace(/"/g, "")}"`,
      "cache-control": "private, max-age=300",
    },
  });
}

export async function deleteFilesWhere(env: Env, where: string, ...binds: unknown[]) {
  const { results } = await env.DB.prepare(`SELECT id, r2_key FROM files WHERE ${where}`)
    .bind(...binds)
    .all<{ id: string; r2_key: string }>();
  for (let i = 0; i < results.length; i += 500) {
    const chunk = results.slice(i, i + 500);
    await env.FILES.delete(chunk.map((r) => r.r2_key));
    await env.DB.prepare(`DELETE FROM files WHERE id IN (${chunk.map(() => "?").join(",")})`)
      .bind(...chunk.map((r) => r.id))
      .run();
  }
  return results.length;
}
