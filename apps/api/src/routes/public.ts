import { Hono } from "hono";
import { z } from "zod";
import { ApiError, badRequest, forbidden } from "@/lib/errors";
import { type AppEnv, background, body } from "@/lib/http";
import { EventInput, trackEvents } from "@/services/events";
import { uploadFile } from "@/services/files";
import { type Form, getFormById, publicForm } from "@/services/forms";
import { createPayment } from "@/services/payments";
import { DraftInput, type RequestInfo, SubmitInput, saveDraft, submit } from "@/services/submissions";
import { checkVerification, startVerification } from "@/services/verify";

/** Endpoints a respondent's browser calls. Identified by form id; guarded by origin allowlist, rate limits and Turnstile. */
export const publicApi = new Hono<AppEnv & { Variables: { form: Form } }>();

const SessionId = z.string().min(8).max(64);

publicApi.use("/:formId/*", async (c, next) => {
  const form = await getFormById(c.env, c.req.param("formId"));
  const origin = c.req.header("origin");
  const allowed = form.settings.allowedOrigins;
  if (origin && allowed.length && !allowed.includes(origin)) throw forbidden(`Origin ${origin} is not allowed for this form`);
  if (c.req.method !== "GET") {
    const ip = c.req.header("cf-connecting-ip") ?? "local";
    const { success } = await c.env.PUBLIC_LIMITER.limit({ key: `${ip}:${form.id}` });
    if (!success) throw new ApiError(429, "rate_limited", "Too many requests");
  }
  c.set("form", form);
  await next();
});

const info = (c: { req: { header: (n: string) => string | undefined; raw: Request } }): RequestInfo => ({
  origin: c.req.header("origin") ?? null,
  referer: c.req.header("referer") ?? null,
  userAgent: c.req.header("user-agent") ?? null,
  ip: c.req.header("cf-connecting-ip") ?? null,
  country: (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? null,
});

publicApi.get("/:formId", (c) => c.json(publicForm(c.get("form"))));

publicApi.post("/:formId/submissions", async (c) => {
  const input = await body(c, SubmitInput);
  return c.json(await submit(c.env, c.get("form"), input, info(c), background(c)), 201);
});

publicApi.put("/:formId/drafts/:sessionId", async (c) => {
  const sessionId = SessionId.parse(c.req.param("sessionId"));
  return c.json(await saveDraft(c.env, c.get("form"), sessionId, await body(c, DraftInput), info(c)));
});

/** Raw body upload: POST ?sessionId=...&name=... with Content-Type and Content-Length. */
publicApi.post("/:formId/uploads", async (c) => {
  const sessionId = SessionId.safeParse(c.req.query("sessionId"));
  if (!sessionId.success) throw badRequest("sessionId query param is required");
  if (!c.req.raw.body) throw badRequest("Empty body");
  const name = (c.req.query("name") ?? "file").slice(0, 255);
  const file = await uploadFile(c.env, c.get("form"), {
    sessionId: sessionId.data,
    name,
    type: c.req.header("content-type") ?? "application/octet-stream",
    size: Number(c.req.header("content-length") ?? 0),
    body: c.req.raw.body,
  });
  return c.json(file, 201);
});

publicApi.post("/:formId/events", async (c) => {
  const input = await body(c, z.object({ sessionId: SessionId, events: z.array(EventInput).min(1).max(20) }));
  await trackEvents(c.env, c.get("form"), input.sessionId, input.events);
  return c.body(null, 204);
});

publicApi.post("/:formId/verify", async (c) => {
  const input = await body(c, z.object({ channel: z.enum(["email", "sms"]), to: z.string().max(320) }));
  return c.json(await startVerification(c.env, c.get("form"), input.channel, input.to), 201);
});

publicApi.post("/:formId/verify/check", async (c) => {
  const input = await body(c, z.object({ id: z.string(), code: z.string().max(10) }));
  return c.json(await checkVerification(c.env, c.get("form"), input.id, input.code));
});

publicApi.post("/:formId/payments", async (c) => {
  const input = await body(c, z.object({ sessionId: SessionId, data: z.record(z.string(), z.unknown()) }));
  return c.json(await createPayment(c.env, c.get("form"), input.sessionId, input.data), 201);
});
