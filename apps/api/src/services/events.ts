import { z } from "zod";
import type { Auth, Env } from "@/env";
import { now } from "@/lib/ids";
import { type Form, getForm } from "@/services/forms";

export const EventInput = z.object({
  type: z.enum(["view", "start", "step", "complete"]),
  step: z.string().max(100).optional(),
});

export async function trackEvents(env: Env, form: Form, sessionId: string, events: z.infer<typeof EventInput>[]) {
  const t = now();
  await env.DB.batch(
    events.slice(0, 20).map((e) =>
      env.DB.prepare("INSERT INTO events (form_id, session_id, type, step, created_at) VALUES (?, ?, ?, ?, ?)").bind(
        form.id,
        sessionId,
        e.type,
        e.step ?? null,
        t,
      ),
    ),
  );
}

/** Funnel for a form: unique sessions that viewed, started, reached each step, and completed. */
export async function getAnalytics(env: Env, auth: Auth, formId: string, range: { since?: number; until?: number }) {
  await getForm(env, auth, formId);
  const since = range.since ?? now() - 30 * 24 * 3600 * 1000;
  const until = range.until ?? now();
  const [funnel, steps, daily, completes] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare(
      `SELECT type, COUNT(DISTINCT session_id) AS sessions FROM events
       WHERE form_id = ? AND created_at BETWEEN ? AND ? AND type IN ('view', 'start') GROUP BY type`,
    ).bind(formId, since, until),
    env.DB.prepare(
      `SELECT step, COUNT(DISTINCT session_id) AS sessions, MIN(created_at) AS first_seen FROM events
       WHERE form_id = ? AND created_at BETWEEN ? AND ? AND type = 'step' AND step IS NOT NULL
       GROUP BY step ORDER BY sessions DESC, first_seen ASC LIMIT 100`,
    ).bind(formId, since, until),
    env.DB.prepare(
      `SELECT date(completed_at / 1000, 'unixepoch') AS day, COUNT(*) AS count FROM submissions
       WHERE form_id = ? AND completed_at BETWEEN ? AND ? GROUP BY day ORDER BY day`,
    ).bind(formId, since, until),
    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM submissions WHERE form_id = ? AND completed_at BETWEEN ? AND ?`,
    ).bind(formId, since, until),
  ]);
  const byType = Object.fromEntries((funnel!.results as { type: string; sessions: number }[]).map((r) => [r.type, r.sessions]));
  const views = byType.view ?? 0;
  const starts = byType.start ?? 0;
  const completed = (completes!.results[0] as { count: number } | undefined)?.count ?? 0;
  return {
    since,
    until,
    views,
    starts,
    completes: completed,
    startRate: views ? starts / views : null,
    completionRate: starts ? completed / starts : null,
    steps: (steps!.results as { step: string; sessions: number }[]).map((s) => ({
      step: s.step,
      sessions: s.sessions,
      dropOff: starts ? 1 - s.sessions / starts : null,
    })),
    daily: daily!.results as { day: string; count: number }[],
  };
}
