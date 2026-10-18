import type { Env } from "@/env";
import { now } from "@/lib/ids";
import { deleteFilesWhere } from "@/services/files";
import { FormSettings } from "@/services/forms";
import { parseJson } from "@/lib/json";

const DAY = 24 * 3600 * 1000;
const DRAFT_TTL = 30 * DAY;
const EVENT_TTL = 180 * DAY;

/** Daily cleanup: per-form retention, stale drafts and orphaned uploads, old events and codes. */
export async function runRetention(env: Env) {
  const { results: forms } = await env.DB.prepare("SELECT id, settings FROM forms").all<{ id: string; settings: string }>();
  let submissions = 0;
  for (const f of forms) {
    const days = FormSettings.parse(parseJson(f.settings, {})).retentionDays;
    if (!days) continue;
    const cutoff = now() - days * DAY;
    await deleteFilesWhere(
      env,
      "submission_id IN (SELECT id FROM submissions WHERE form_id = ? AND created_at < ?)",
      f.id,
      cutoff,
    );
    const res = await env.DB.prepare("DELETE FROM submissions WHERE form_id = ? AND created_at < ?").bind(f.id, cutoff).run();
    submissions += res.meta.changes ?? 0;
  }
  const draftCutoff = now() - DRAFT_TTL;
  await deleteFilesWhere(env, "submission_id IS NULL AND created_at < ?", draftCutoff);
  const drafts = await env.DB.prepare("DELETE FROM submissions WHERE status = 'draft' AND updated_at < ?").bind(draftCutoff).run();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM events WHERE created_at < ?").bind(now() - EVENT_TTL),
    env.DB.prepare("DELETE FROM verifications WHERE expires_at < ?").bind(now() - DAY),
    env.DB.prepare("DELETE FROM hook_runs WHERE created_at < ?").bind(now() - 30 * DAY),
  ]);
  return { submissions, drafts: drafts.meta.changes ?? 0 };
}
