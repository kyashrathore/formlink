import { FormlinkError, type RequestOptions, request } from "./http.js";

export interface PublicForm {
  id: string;
  name: string;
  open: boolean;
  turnstile: boolean;
  verification: "email" | "sms" | null;
  payment: boolean;
  uploads: { maxBytes: number; allowedTypes: string[] };
}

export interface SubmitResult {
  id: string;
  status: string;
  computed: Record<string, unknown>;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface FormOptions {
  formId: string;
  /** API origin. Defaults to "" (same origin), which is right for apps hosted on Formlink. */
  baseUrl?: string;
  /** Reuse a session id; by default one is kept per form in sessionStorage. */
  sessionId?: string;
  /** Add UTM and other query params, the page URL and referrer to meta. Default true. */
  captureContext?: boolean;
  fetch?: typeof fetch;
}

export type EventType = "view" | "start" | "step" | "complete";
type Data = Record<string, unknown>;

const storageKey = (formId: string) => `formlink:${formId}:session`;

function newSessionId() {
  return `s_${globalThis.crypto.randomUUID().replace(/-/g, "")}`;
}

function storedSession(formId: string): string {
  try {
    const existing = globalThis.sessionStorage?.getItem(storageKey(formId));
    if (existing) return existing;
    const id = newSessionId();
    globalThis.sessionStorage?.setItem(storageKey(formId), id);
    return id;
  } catch {
    return newSessionId();
  }
}

/** Page context: query params (UTM, hidden fields), URL and referrer. Empty outside a browser. */
export function pageContext(): Record<string, string> {
  const loc = (globalThis as { location?: Location }).location;
  if (!loc) return {};
  const out: Record<string, string> = {};
  new URLSearchParams(loc.search).forEach((v, k) => {
    if (k !== "token") out[k] = v;
  });
  out.$url = loc.href.split("?")[0]!;
  const ref = (globalThis as { document?: Document }).document?.referrer;
  if (ref) out.$referrer = ref;
  return out;
}

/** Client for one form, used by the respondent-facing app. */
export function createForm(options: FormOptions) {
  const { formId } = options;
  const http: RequestOptions = { baseUrl: options.baseUrl ?? "", fetch: options.fetch };
  const base = `/v1/f/${encodeURIComponent(formId)}`;
  let sessionId = options.sessionId ?? storedSession(formId);
  const withContext = (meta?: Data) =>
    options.captureContext === false ? meta : { ...pageContext(), ...(meta ?? {}) };

  return {
    get formId() {
      return formId;
    },
    get sessionId() {
      return sessionId;
    },

    /** Public settings: whether it's open and which checks (Turnstile, verification, payment) apply. */
    info: () => request<PublicForm>(http, "GET", base),

    /** Funnel event. Fire-and-forget; failures never throw. */
    track(type: EventType, step?: string) {
      request(http, "POST", `${base}/events`, { sessionId, events: [{ type, step }] }, { keepalive: true }).catch(
        () => {},
      );
    },

    /** Save partial answers so drop-offs are kept. Call after each step. */
    saveDraft: (data: Data, meta?: Data) =>
      request<{ id: string; status: "draft" }>(http, "PUT", `${base}/drafts/${sessionId}`, {
        data,
        meta: withContext(meta),
      }),

    /** Upload a file; it is attached to this session's submission when it completes. */
    upload(file: Blob & { name?: string }, name = file.name ?? "file") {
      const q = new URLSearchParams({ sessionId, name });
      return request<UploadedFile>(http, "POST", `${base}/uploads?${q}`, undefined, {
        raw: file,
        headers: { "content-type": file.type || "application/octet-stream" },
      });
    },

    verify: {
      /** Sends a 6-digit code through the form's sendVerification hook. */
      start: (channel: "email" | "sms", to: string) =>
        request<{ id: string; expiresAt: number }>(http, "POST", `${base}/verify`, { channel, to }),
      /** Returns a token to pass as `verificationToken` on submit. */
      check: (id: string, code: string) =>
        request<{ token: string; channel: string; target: string }>(http, "POST", `${base}/verify/check`, { id, code }),
    },

    /** Creates a Stripe PaymentIntent priced by the form's price hook. Confirm it with Stripe.js. */
    createPayment: (data: Data) =>
      request<{ paymentIntentId: string; clientSecret: string; amount: number; currency: string }>(
        http,
        "POST",
        `${base}/payments`,
        { sessionId, data },
      ),

    /** Completes the submission. Throws FormlinkError; check `fieldErrors` for hook validation messages. */
    async submit(
      data: Data,
      extra: { meta?: Data; turnstileToken?: string; verificationToken?: string; paymentIntentId?: string } = {},
    ) {
      const result = await request<SubmitResult>(http, "POST", `${base}/submissions`, {
        data,
        sessionId,
        meta: withContext(extra.meta),
        turnstileToken: extra.turnstileToken,
        verificationToken: extra.verificationToken,
        paymentIntentId: extra.paymentIntentId,
      });
      try {
        globalThis.sessionStorage?.removeItem(storageKey(formId));
      } catch {
        /* storage unavailable */
      }
      return result;
    },

    context: pageContext,

    /** Start a fresh attempt (new session id). */
    reset() {
      sessionId = newSessionId();
      try {
        globalThis.sessionStorage?.setItem(storageKey(formId), sessionId);
      } catch {
        /* storage unavailable */
      }
      return sessionId;
    },
  };
}

export type FormClient = ReturnType<typeof createForm>;
export { FormlinkError };
