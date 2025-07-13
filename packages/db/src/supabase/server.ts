import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database.types";
import { createServerClient } from "@supabase/ssr";

// Helper function to determine if we should use local Supabase
function useLocalSupabase(): boolean {
  // Check for explicit env var first
  if (process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE === 'true') {
    return true
  }
  
  // Default to true in development
  return process.env.NODE_ENV === 'development'
}

export const createClient = async (
  cookieStore: any,
  keyType: "anon" | "service" = "anon"
): Promise<SupabaseClient<Database>> => {
  const url = useLocalSupabase() 
    ? (process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL || 'http://localhost:54321')
    : process.env.NEXT_PUBLIC_SUPABASE_URL!
  
  const anonKey = useLocalSupabase()
    ? (process.env.NEXT_PUBLIC_SUPABASE_LOCAL_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0')
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const serviceKey = useLocalSupabase()
    ? (process.env.SUPABASE_LOCAL_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU')
    : process.env.SUPABASE_SERVICE_ROLE!

  if (!cookieStore && keyType === "service") {
    return createServerClient<Database>(
      url,
      serviceKey,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    );
  }
  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll: () => cookieStore?.getAll() || [],
        setAll: (cookiesToSet) => {
          try {
            if (cookieStore) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } else {
              console.log("No cookie store found");
            }
          } catch (error) {
            console.error("Error setting cookies:", error);
          }
        },
      },
    }
  );
};
