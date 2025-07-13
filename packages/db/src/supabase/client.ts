import { Database } from "@/types/database.types"
import { createBrowserClient } from "@supabase/ssr"

// Helper function to determine if we should use local Supabase
function useLocalSupabase(): boolean {
  // Check for explicit env var first
  if (process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE === 'true') {
    return true
  }
  
  // Default to true in development
  return process.env.NODE_ENV === 'development'
}

export function createClient() {
  const isLocal = useLocalSupabase()
  const url = isLocal 
    ? (process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL || 'http://localhost:54321')
    : process.env.NEXT_PUBLIC_SUPABASE_URL!
  
  const anonKey = isLocal
    ? (process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0')
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Debug logging commented out to reduce noise
  // console.log('Creating Supabase client:', {
  //   isLocal,
  //   url,
  //   hasAnonKey: !!anonKey,
  //   env: process.env.NODE_ENV,
  //   useLocalEnvVar: process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE
  // })

  return createBrowserClient<Database>(url, anonKey)
}
