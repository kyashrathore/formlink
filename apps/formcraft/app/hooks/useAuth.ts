"use client"

import { createBrowserClient } from "@formlink/db"
import { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const supabase = createBrowserClient()

  useEffect(() => {
    async function getUser() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) {
          // Auth error occurred
          setLoading(false)
          return
        }

        setUser(user)

        // Check if user is anonymous
        if (user) {
          // For anonymous users, check the email pattern first
          const isAnonymousEmail =
            user.email?.endsWith("@anonymous.local") ||
            user.email?.includes("@anonymous.example") ||
            !user.email

          // If it looks like an anonymous email, set it immediately
          if (isAnonymousEmail) {
            setIsAnonymous(true)
          }

          // Then try to verify from the database
          try {
            const { data: userData, error: dbError } = await supabase
              .from("users")
              .select("anonymous")
              .eq("id", user.id)
              .maybeSingle() // Use maybeSingle instead of single to handle 0 rows gracefully

            if (dbError) {
              // Database error checking anonymous status
              // Keep the email-based detection if DB query fails
              if (!isAnonymousEmail) {
                setIsAnonymous(false)
              }
            } else if (!userData) {
              // User record doesn't exist yet - use email-based detection
              // User record not found yet, using email-based detection
              // Keep the email-based detection
            } else {
              // We have data from DB, use it
              setIsAnonymous(userData.anonymous || false)
            }
          } catch (error) {
            // Error checking anonymous status
            // Keep the email-based detection if error occurs
            if (!isAnonymousEmail) {
              setIsAnonymous(false)
            }
          }
        } else {
          setIsAnonymous(false)
        }
      } catch (error) {
        // Unexpected error in getUser
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        // Auth loading timeout - forcing loading to false
        setLoading(false)
      }
    }, 5000) // 5 second timeout

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          setUser(session?.user ?? null)

          // Check if user is anonymous on auth state change
          if (session?.user) {
            // For anonymous users, check the email pattern first
            const isAnonymousEmail =
              session.user.email?.endsWith("@anonymous.local") ||
              session.user.email?.includes("@anonymous.example") ||
              !session.user.email

            // If it looks like an anonymous email, set it immediately
            if (isAnonymousEmail) {
              setIsAnonymous(true)
            }

            // Then try to verify from the database
            try {
              const { data: userData, error: dbError } = await supabase
                .from("users")
                .select("anonymous")
                .eq("id", session.user.id)
                .maybeSingle() // Use maybeSingle to handle 0 rows gracefully

              if (dbError) {
                // Database error in auth state change
                // Keep the email-based detection if DB query fails
                if (!isAnonymousEmail) {
                  setIsAnonymous(false)
                }
              } else if (!userData) {
                // User record doesn't exist yet - use email-based detection
                // User record not found in auth state change, using email-based detection
                // Keep the email-based detection
              } else {
                // We have data from DB, use it
                setIsAnonymous(userData.anonymous || false)
              }
            } catch (error) {
              // Error checking anonymous status in auth state change
              // Keep the email-based detection if error occurs
              if (!isAnonymousEmail) {
                setIsAnonymous(false)
              }
            }
          } else {
            setIsAnonymous(false)
          }
        } catch (error) {
          // Error in auth state change handler
        } finally {
          setLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      authListener?.subscription.unsubscribe()
    }
  }, [supabase])

  return { user, loading, isAnonymous }
}
