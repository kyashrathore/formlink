import { type RequestOptions, request } from "./http.js";

type Data = Record<string, unknown>;

export interface FormSettings {
  allowedOrigins: string[];
  turnstile: boolean;
  retentionDays?: number;
  uploads: { maxBytes: number; allowedTypes: string[] };
  verification?: "email" | "sms";
  payment: boolean;
  maxSubmissions?: number;
  closesAt?: number;
}

/** A settings patch: omitted keys are kept, `null` resets to the default. */
export type SettingsPatch = { [K in keyof FormSettings]?: (K extends "uploads" ? Partial<FormSettings[K]> : FormSettings[K]) | null };

export interface Form {
  id: string;
  workspaceId: string;
  name: string;
  status: "open" | "closed";
  settings: FormSettings;
  hookVersion: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Submission {
  id: string;
  formId: string;
  sessionId: string | null;
  status: string;
  data: Data;
  computed: Data;
  meta: Data;
  verified: { channel: "email" | "sms"; target: string } | null;
  payment: { id: string; amount: number; currency: string; status: string } | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  files?: { id: string; name: string; type: string; size: number; url: string }[];
}

export interface Site {
  id: string;
  slug: string;
  name: string;
  visibility: "public" | "private";
  dataForms: string[];
  url: string;
  shareUrl: string;
  domains: { hostname: string; status: string }[];
  activeDeployment: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface HookResult {
  handled: boolean;
  result?: unknown;
  error?: string;
  logs: string[];
}

export type HookEvent = "beforeSubmit" | "afterSubmit" | "onStatusChange" | "price" | "sendVerification";

export interface Analytics {
  since: number;
  until: number;
  views: number;
  starts: number;
  completes: number;
  startRate: number | null;
  completionRate: number | null;
  steps: { step: string; sessions: number; dropOff: number | null }[];
  daily: { day: string; count: number }[];
}

/** File content for a deployment: text, bytes, or an explicit encoding. */
export type DeployFile = string | Uint8Array | { content: string; encoding?: "utf8" | "base64"; contentType?: string };

export interface AdminOptions {
  baseUrl: string;
  /** A secret API key (fl_sk_...). Server-side only: never ship it to a browser. */
  apiKey?: string;
  /** Inside a private Formlink-hosted view: the site slug. Grants read-only access via the share-link cookie. */
  site?: string;
  fetch?: typeof fetch;
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const qs = (params: Record<string, unknown>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

const enc = encodeURIComponent;

/** Client for the admin API: forms, hooks, submissions, secrets, sites and domains. */
export function createAdmin(options: AdminOptions) {
  const headers: Record<string, string> = {};
  if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;
  if (options.site) headers["x-formlink-site"] = options.site;
  const http: RequestOptions = { baseUrl: options.baseUrl, headers, fetch: options.fetch };
  const call = <T>(method: string, path: string, body?: unknown) => request<T>(http, method, `/v1${path}`, body);

  return {
    me: () => call<{ workspace: { id: string; name: string }; role: "admin" | "read" }>("GET", "/me"),

    keys: {
      list: () => call<{ keys: { id: string; name: string; role: string; prefix: string }[] }>("GET", "/keys").then((r) => r.keys),
      create: (name: string, role: "admin" | "read" = "admin") =>
        call<{ id: string; name: string; role: string; secret: string }>("POST", "/keys", { name, role }),
      revoke: (id: string) => call<void>("DELETE", `/keys/${enc(id)}`),
    },

    forms: {
      list: () => call<{ forms: Form[] }>("GET", "/forms").then((r) => r.forms),
      create: (input: { name: string; status?: "open" | "closed"; settings?: SettingsPatch }) => call<Form>("POST", "/forms", input),
      get: (formId: string) => call<Form>("GET", `/forms/${enc(formId)}`),
      update: (formId: string, input: { name?: string; status?: "open" | "closed"; settings?: SettingsPatch }) =>
        call<Form>("PATCH", `/forms/${enc(formId)}`, input),
      delete: (formId: string) => call<void>("DELETE", `/forms/${enc(formId)}`),
    },

    hooks: {
      get: (formId: string) => call<{ formId: string; version: number | null; code: string | null }>("GET", `/forms/${enc(formId)}/hook`),
      /** Saves a new version after checking it loads. Empty code removes the hook. */
      set: (formId: string, code: string) =>
        call<{ formId: string; version: number | null; exports: string[]; warnings?: string[] }>("PUT", `/forms/${enc(formId)}/hook`, { code }),
      /** Runs one event against sample input without storing; `code` tests unsaved source. */
      test: (formId: string, event: HookEvent, input: Data = {}, code?: string) =>
        call<HookResult>("POST", `/forms/${enc(formId)}/hook/test`, { event, input, code }),
      runs: (formId: string, limit = 20) =>
        call<{ runs: (HookResult & { id: string; event: string; ok: boolean; durationMs: number; createdAt: number })[] }>(
          "GET",
          `/forms/${enc(formId)}/hook/runs${qs({ limit })}`,
        ).then((r) => r.runs),
    },

    submissions: {
      list: (
        formId: string,
        query: { status?: string; drafts?: boolean; since?: number; until?: number; q?: string; limit?: number; cursor?: string } = {},
      ) => call<{ submissions: Submission[]; nextCursor: string | null }>("GET", `/forms/${enc(formId)}/submissions${qs(query)}`),
      /** Every submission, following cursors. */
      async all(formId: string, query: { status?: string; since?: number; until?: number; q?: string } = {}) {
        const out: Submission[] = [];
        let cursor: string | undefined;
        do {
          const page = await call<{ submissions: Submission[]; nextCursor: string | null }>(
            "GET",
            `/forms/${enc(formId)}/submissions${qs({ ...query, limit: 500, cursor })}`,
          );
          out.push(...page.submissions);
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
        return out;
      },
      get: (id: string) => call<Submission>("GET", `/submissions/${enc(id)}`),
      update: (id: string, patch: { status?: string; data?: Data; computed?: Data }) => call<Submission>("PATCH", `/submissions/${enc(id)}`, patch),
      delete: (id: string) => call<void>("DELETE", `/submissions/${enc(id)}`),
      export: (formId: string, format: "csv" | "json" = "csv") =>
        request<string>(http, "GET", `/v1/forms/${enc(formId)}/export${qs({ format })}`, undefined, { text: true }),
    },

    analytics: (formId: string, range: { since?: number; until?: number } = {}) =>
      call<Analytics>("GET", `/forms/${enc(formId)}/analytics${qs(range)}`),

    secrets: {
      list: () => call<{ secrets: { name: string; updatedAt: number }[] }>("GET", "/secrets").then((r) => r.secrets),
      set: (name: string, value: string) => call<void>("PUT", `/secrets/${enc(name)}`, { value }),
      delete: (name: string) => call<void>("DELETE", `/secrets/${enc(name)}`),
    },

    sites: {
      list: () => call<{ sites: Site[] }>("GET", "/sites").then((r) => r.sites),
      create: (input: { name: string; slug?: string; visibility?: "public" | "private"; dataForms?: string[] }) =>
        call<Site>("POST", "/sites", input),
      get: (siteId: string) => call<Site>("GET", `/sites/${enc(siteId)}`),
      update: (
        siteId: string,
        input: { name?: string; slug?: string; visibility?: "public" | "private"; dataForms?: string[]; rotateShareToken?: boolean },
      ) => call<Site>("PATCH", `/sites/${enc(siteId)}`, input),
      delete: (siteId: string) => call<void>("DELETE", `/sites/${enc(siteId)}`),
      /** Publishes a complete build (must include index.html) and makes it live. */
      deploy(siteId: string, files: Record<string, DeployFile>) {
        const payload: Record<string, { content: string; encoding: "utf8" | "base64"; contentType?: string }> = {};
        for (const [path, f] of Object.entries(files)) {
          if (typeof f === "string") payload[path] = { content: f, encoding: "utf8" };
          else if (f instanceof Uint8Array) payload[path] = { content: toBase64(f), encoding: "base64" };
          else payload[path] = { content: f.content, encoding: f.encoding ?? "utf8", contentType: f.contentType };
        }
        return call<{ deploymentId: string; files: number; bytes: number; site: Site }>(
          "POST",
          `/sites/${enc(siteId)}/deployments`,
          { files: payload },
        );
      },
      deployments: (siteId: string) =>
        call<{ deployments: { id: string; files: number; createdAt: number }[] }>("GET", `/sites/${enc(siteId)}/deployments`).then(
          (r) => r.deployments,
        ),
      rollback: (siteId: string, deploymentId: string) => call<Site>("POST", `/sites/${enc(siteId)}/rollback`, { deploymentId }),
    },

    domains: {
      add: (siteId: string, hostname: string) => call<DomainInfo>("POST", `/sites/${enc(siteId)}/domains`, { hostname }),
      get: (hostname: string) => call<DomainInfo>("GET", `/domains/${enc(hostname)}`),
      remove: (hostname: string) => call<void>("DELETE", `/domains/${enc(hostname)}`),
    },
  };
}

export interface DomainInfo {
  hostname: string;
  status: string;
  dns: { type: "CNAME"; name: string; target: string | null };
  verification: unknown;
}

export type AdminClient = ReturnType<typeof createAdmin>;

/** Creates a workspace and returns its first admin key. */
export function signup(baseUrl: string, name: string, signupToken?: string) {
  return request<{ workspace: { id: string; name: string }; key: { id: string; secret: string } }>(
    { baseUrl },
    "POST",
    "/v1/workspaces",
    { name, signupToken },
  );
}
