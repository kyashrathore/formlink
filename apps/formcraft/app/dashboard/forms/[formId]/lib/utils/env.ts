export function getEnvVars(env?: Record<string, any>): Record<string, any> {
  if (env) return env
  // Always use process.env as Cloudflare context is no longer available
  return process.env
}

export function getRequiredEnvVar(
  key: string,
  env?: Record<string, any>
): string {
  const allEnv = getEnvVars(env)
  const value = allEnv[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

/**
 * Check if the app is running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development"
}

/**
 * Check if the app is running on localhost
 */
export function isLocalhost(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  )
}

/**
 * Check if we should use local Supabase
 */
export function useLocalSupabase(): boolean {
  // Check for explicit env var first
  if (process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE === "true") {
    return true
  }

  // Force false for production Supabase
  if (process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE === "false") {
    return false
  }

  // Default to true in development or when running on port 3000
  return (
    isDevelopment() ||
    (typeof window !== "undefined" && window.location.port === "3000")
  )
}

/**
 * Get the appropriate Supabase URL based on environment
 */
export function getSupabaseUrl(): string {
  if (useLocalSupabase()) {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL || "http://127.0.0.1:54321"
    )
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL!
}

/**
 * Get the appropriate Supabase anon key based on environment
 */
export function getSupabaseAnonKey(): string {
  if (useLocalSupabase()) {
    // Local development uses a standard anon key
    return (
      process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    )
  }
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
}

/**
 * Get the appropriate Turnstile site key based on environment
 */
export function getTurnstileSiteKey(): string {
  if (isLocalhost()) {
    // Use test key for localhost - invisible widget, always passes
    return "1x00000000000000000000BB"
  }
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""
}

/**
 * Environment info for debugging
 */
export function getEnvironmentInfo() {
  return {
    isDevelopment: isDevelopment(),
    isLocalhost: isLocalhost(),
    useLocalSupabase: useLocalSupabase(),
    supabaseUrl: getSupabaseUrl(),
    turnstileSiteKey: getTurnstileSiteKey(),
    nodeEnv: process.env.NODE_ENV,
  }
}
