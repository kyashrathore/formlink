export { createClient as createBrowserClient } from "./supabase/client";
export { createClient as createServerClient } from "./supabase/server";
export { createGuestServerClient } from "./supabase/server-guest";

// Export only the specific types and utilities we need from Supabase
export type {
  SupabaseClient,
  PostgrestError,
  PostgrestResponse,
  PostgrestSingleResponse,
  User,
  Session,
  AuthError,
  AuthResponse,
  AuthTokenResponse,
} from "@supabase/supabase-js";

export * from "./types/database.types";
export { createServerClient as ssrCreateServerClient } from "@supabase/ssr";
