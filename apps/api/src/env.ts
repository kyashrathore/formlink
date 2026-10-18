import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  OAUTH_KV: KVNamespace;
  LOADER: WorkerLoader;
  PUBLIC_LIMITER: RateLimit;
  PUBLIC_URL: string;
  SITES_DOMAIN: string;
  CF_ZONE_ID: string;
  CF_API_TOKEN?: string;
  SECRETS_KEY: string;
  SIGNING_KEY: string;
  SIGNUP_TOKEN?: string;
  OAUTH_PROVIDER: OAuthHelpers;
  /** Overrides for third-party endpoints, used by tests against local mocks. */
  STRIPE_API_URL?: string;
  TURNSTILE_VERIFY_URL?: string;
  CF_API_URL?: string;
}

/** Who is calling. `formIds` narrows a read-only caller (a private site) to specific forms. */
export interface Auth {
  workspaceId: string;
  role: "admin" | "read";
  keyId?: string;
  formIds?: string[];
}
