"use client"

import { createBrowserClient, User } from "@formlink/db"
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
          setLoading(false)
          return
        }

        setUser(user)

        if (user) {
          const isAnonymousEmail =
            user.email?.endsWith("@anonymous.local") ||
            user.email?.includes("@anonymous.example") ||
            !user.email

          if (isAnonymousEmail) {
            setIsAnonymous(true)
          }

          try {
            const { data: userData, error: dbError } = await supabase
              .from("users")
              .select("anonymous")
              .eq("id", user.id)
              .maybeSingle()

            if (dbError) {
              if (!isAnonymousEmail) {
                setIsAnonymous(false)
              }
            } else if (!userData) {
            } else {
              setIsAnonymous(userData.anonymous || false)
            }
          } catch (_error) {
            console.error("Error fetching user data", _error)
            if (!isAnonymousEmail) {
              setIsAnonymous(false)
            }
          }
        } else {
          setIsAnonymous(false)
        }
      } catch (_error) {
        console.error("Error getting user", _error)
        setUser(null)
        setIsAnonymous(false)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false)
      }
    }, 5000)

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          setUser(session?.user ?? null)

          if (session?.user) {
            const isAnonymousEmail =
              session.user.email?.endsWith("@anonymous.local") ||
              session.user.email?.includes("@anonymous.example") ||
              !session.user.email

            if (isAnonymousEmail) {
              setIsAnonymous(true)
            }

            try {
              const { data: userData, error: dbError } = await supabase
                .from("users")
                .select("anonymous")
                .eq("id", session.user.id)
                .maybeSingle()

              if (dbError) {
                if (!isAnonymousEmail) {
                  setIsAnonymous(false)
                }
              } else if (!userData) {
              } else {
                setIsAnonymous(userData.anonymous || false)
              }
            } catch (_error) {
              console.error("Error fetching user data", _error)
              if (!isAnonymousEmail) {
                setIsAnonymous(false)
              }
            }
          } else {
            setIsAnonymous(false)
          }
        } catch (_error) {
          console.error("Error during auth state change", _error)
          setUser(null)
          setIsAnonymous(false)
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
