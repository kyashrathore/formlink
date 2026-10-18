import type { Context } from "hono";
import { ZodError, type z } from "zod";
import type { Auth, Env } from "@/env";
import { ApiError, badRequest } from "@/lib/errors";

export type AppEnv = { Bindings: Env; Variables: { auth: Auth; siteAuth?: Auth | null } };

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const res = schema.safeParse(value);
  if (!res.success)
    throw badRequest(
      "Invalid input",
      res.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  return res.data;
}

export async function body<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw badRequest("Body must be JSON");
  }
  return parse(schema, json);
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError)
    return Response.json(
      { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
      { status: err.status },
    );
  if (err instanceof ZodError) return Response.json({ error: { code: "bad_request", message: err.message } }, { status: 400 });
  console.error(err);
  return Response.json({ error: { code: "internal", message: "Internal error" } }, { status: 500 });
}

export const background = (c: Context) => (p: Promise<unknown>) =>
  c.executionCtx.waitUntil(p.catch((err) => console.error("background task failed", err)));
