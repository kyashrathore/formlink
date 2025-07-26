"use client"

import { useTheme } from "next-themes"
import posthog from "posthog-js"
import { useEffect } from "react"
import { Navigation } from "../components/landing/navigation"

export default function FeedbackPage() {
  const { theme } = useTheme()

  useEffect(() => {
    const isLocalhost = window.location.hostname === "localhost"
    const userId =
      localStorage.getItem("userId") || sessionStorage.getItem("userId") || ""
    const isTestUser =
      userId === "dsfsdf" ||
      userId.includes("dsfsdf") ||
      userId === "ac7f4c28-e255-4551-a418-ce2630af2ce8" ||
      userId.includes("ac7f4c28-e255-4551-a418-ce2630af2ce8")

    if (isLocalhost || isTestUser) {
      return
    }

    posthog.capture("feedback_page_viewed", {
      referrer: document.referrer,
      theme: theme || "light",
    })
  }, [])

  const portalUrl = `https://feedback.formlink.com?theme=${theme}`

  return (
    <div className="bg-background min-h-screen">
      {}
      <Navigation />

      {}
      <div className="pt-20">
        {}
        <div className="bg-card border-b px-6 py-8">
          <div className="container-custom">
            <h1 className="mb-2 text-3xl font-bold">
              Feedback & Feature Requests
            </h1>
            <p className="text-muted-foreground text-lg">
              Help us improve Formfiller by sharing your feedback and ideas
            </p>
          </div>
        </div>

        {}
        <div className="h-[calc(100vh-13rem)]">
          <iframe
            src={portalUrl}
            className="h-full w-full border-0"
            title="Formfiller Feedback Portal"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  )
}
