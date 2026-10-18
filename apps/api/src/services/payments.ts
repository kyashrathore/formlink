import type { Env } from "@/env";
import { ApiError, badRequest } from "@/lib/errors";
import type { Form } from "@/services/forms";
import { runHook } from "@/services/hooks";
import { getSecret } from "@/services/secrets";


interface PaymentIntent {
  id: string;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
  client_secret: string;
  metadata: Record<string, string>;
}

async function stripeKey(env: Env, form: Form) {
  const key = await getSecret(env, form.workspaceId, "STRIPE_SECRET_KEY");
  if (!key) throw new ApiError(501, "not_configured", "Set the STRIPE_SECRET_KEY secret to take payments");
  return key;
}

async function stripe<T>(env: Env, key: string, path: string, body?: Record<string, string>) {
  const res = await fetch(`${env.STRIPE_API_URL || "https://api.stripe.com/v1"}${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body: body ? new URLSearchParams(body) : undefined,
  });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new ApiError(502, "stripe_error", json.error?.message ?? "Stripe request failed");
  return json;
}

/**
 * The amount always comes from the form's `price` hook, never from the browser,
 * so a respondent can't change what they pay.
 */
async function quote(env: Env, form: Form, sessionId: string, data: Record<string, unknown>) {
  const priced = await runHook<{ amount: number; currency: string; description?: string }>(env, form, "price", {
    data,
    sessionId,
  });
  if (!priced.handled) throw new ApiError(501, "not_configured", "This form has no price hook");
  if (priced.error) throw new ApiError(502, "hook_failed", "The price hook failed", { error: priced.error });
  const { amount, currency, description } = priced.result ?? ({} as never);
  if (!Number.isInteger(amount) || amount <= 0 || typeof currency !== "string")
    throw new ApiError(502, "hook_failed", "price must return { amount: positive integer (minor units), currency }");
  return { amount, currency: currency.toLowerCase(), description };
}

export async function createPayment(env: Env, form: Form, sessionId: string, data: Record<string, unknown>) {
  if (!form.settings.payment) throw badRequest("This form does not take payments");
  const { amount, currency, description } = await quote(env, form, sessionId, data);
  const pi = await stripe<PaymentIntent>(env, await stripeKey(env, form), "/payment_intents", {
    amount: String(amount),
    currency,
    "automatic_payment_methods[enabled]": "true",
    "metadata[formlink_form]": form.id,
    "metadata[formlink_session]": sessionId,
    ...(description ? { description } : {}),
  });
  return { paymentIntentId: pi.id, clientSecret: pi.client_secret, amount, currency: pi.currency };
}

/**
 * Confirms a PaymentIntent succeeded for this form and session, and that it paid the price
 * of the answers actually submitted, before a submission is accepted.
 */
export async function verifyPayment(
  env: Env,
  form: Form,
  paymentIntentId: string,
  sessionId: string,
  data: Record<string, unknown>,
) {
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) throw badRequest("Invalid paymentIntentId");
  const used = await env.DB.prepare(
    "SELECT id FROM submissions WHERE form_id = ? AND json_extract(payment, '$.id') = ?",
  )
    .bind(form.id, paymentIntentId)
    .first();
  if (used) throw new ApiError(409, "conflict", "This payment was already used for a submission");
  const pi = await stripe<PaymentIntent>(env, await stripeKey(env, form), `/payment_intents/${paymentIntentId}`);
  if (pi.metadata.formlink_form !== form.id || pi.metadata.formlink_session !== sessionId)
    throw badRequest("Payment does not belong to this form session");
  if (pi.status !== "succeeded") throw new ApiError(402, "payment_required", `Payment status is ${pi.status}`);
  const expected = await quote(env, form, sessionId, data);
  if (pi.amount_received !== expected.amount || pi.currency !== expected.currency)
    throw new ApiError(402, "payment_mismatch", "The payment does not match the price of these answers");
  return { id: pi.id, amount: pi.amount_received, currency: pi.currency, status: pi.status };
}
