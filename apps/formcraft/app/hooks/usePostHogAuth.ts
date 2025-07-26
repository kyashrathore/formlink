"use client"

import posthog from "posthog-js"
import { useEffect } from "react"
import { useAuth } from "./useAuth"

export function usePostHogAuth() {
  const { user, loading } = useAuth()

  useEffect(() => {
    const isLocalhost =
      typeof window !== "undefined" && window.location.hostname === "localhost"
    const userId = user?.id || ""
    const isTestUser =
      userId === "ac7f4c28-e255-4551-a418-ce2630af2ce8" ||
      userId.includes("ac7f4c28-e255-4551-a418-ce2630af2ce8")

    if (isLocalhost || isTestUser) {
      return
    }

    if (!loading && user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.name,
        created_at: user.created_at,
      })

      const createdAt = new Date(user.created_at)
      const now = new Date()
      const isNewUser = now.getTime() - createdAt.getTime() < 60000

      if (isNewUser) {
        posthog.capture("user_signed_up", {
          method: user.app_metadata?.provider || "email",
          referrer: document.referrer,
        })
      }
    } else if (!loading && !user) {
      posthog.reset()
    }
  }, [user, loading])
}
