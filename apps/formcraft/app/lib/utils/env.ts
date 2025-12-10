export function getEnvVars(
  env?: Record<string, string | undefined>
): Record<string, string | undefined> {
  if (env) return env

  return process.env
}

export function getRequiredEnvVar(
  key: string,
  env?: Record<string, string | undefined>
): string {
  const allEnv = getEnvVars(env)
  const value = allEnv[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development"
}

export function isLocalhost(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  )
}

export function shouldUseLocalSupabase(): boolean {
  if (process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE === "true") {
    return true
  }

  if (process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE === "false") {
    return false
  }

  return (
    isDevelopment() ||
    (typeof window !== "undefined" && window.location.port === "3000")
  )
}

export function getSupabaseUrl(): string {
  if (shouldUseLocalSupabase()) {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL || "http://127.0.0.1:54321"
    )
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL!
}

export function getSupabaseAnonKey(): string {
  if (shouldUseLocalSupabase()) {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    )
  }
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
}

export function getTurnstileSiteKey(): string {
  if (isLocalhost()) {
    return "1x00000000000000000000BB"
  }
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""
}

export function getEnvironmentInfo() {
  return {
    isDevelopment: isDevelopment(),
    isLocalhost: isLocalhost(),
    useLocalSupabase: shouldUseLocalSupabase(),
    supabaseUrl: getSupabaseUrl(),
    turnstileSiteKey: getTurnstileSiteKey(),
    nodeEnv: process.env.NODE_ENV,
  }
}
