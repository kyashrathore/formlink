"use client"

import { usePathname, useSearchParams } from "next/navigation"
import posthog from "posthog-js"
import { PostHogProvider } from "posthog-js/react"
import { useEffect } from "react"

if (typeof window !== "undefined") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // We'll handle this manually for better control
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: false,
      maskTextSelector: "[data-private]",
    },
    loaded: (posthog) => {
      // Exclude test users and localhost
      if (typeof window !== "undefined") {
        const isLocalhost = window.location.hostname === "localhost"
        const userId =
          localStorage.getItem("userId") ||
          sessionStorage.getItem("userId") ||
          ""
        const isTestUser =
          userId === "dsfsdf" ||
          userId.includes("dsfsdf") ||
          userId === "ac7f4c28-e255-4551-a418-ce2630af2ce8" ||
          userId.includes("ac7f4c28-e255-4551-a418-ce2630af2ce8")

        if (isLocalhost || isTestUser) {
          posthog.opt_out_capturing()
        }
      }
    },
  })
}

export function PostHogPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname && posthog) {
      // Check if analytics should be disabled
      const isLocalhost = window.location.hostname === "localhost"
      const userId =
        localStorage.getItem("userId") || sessionStorage.getItem("userId") || ""
      const isTestUser =
        userId === "dsfsdf" ||
        userId.includes("dsfsdf") ||
        userId === "ac7f4c28-e255-4551-a418-ce2630af2ce8" ||
        userId.includes("ac7f4c28-e255-4551-a418-ce2630af2ce8")

      if (isLocalhost || isTestUser) {
        return // Don't capture pageview
      }

      let url = window.origin + pathname
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthog.capture("$pageview", {
        $current_url: url,
      })
    }
  }, [pathname, searchParams])

  return null
}

export function PostHogProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
