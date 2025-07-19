"use client"

import { useAuth } from "@/app/hooks/useAuth"
import { usePostHogAuth } from "@/app/hooks/usePostHogAuth"
import { useFormAgentStore } from "@/app/stores/formAgentStore"
import { useParams, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

interface DashboardLayoutClientProps {
  children: React.ReactNode
}

export default function DashboardLayoutClient({
  children,
}: DashboardLayoutClientProps) {
  const params = useParams()
  const searchParams = useSearchParams()
  const [activeFormId, setActiveFormId] = useState<string | null>(null)

  // Get user from the useAuth hook
  const { user } = useAuth()

  // Initialize PostHog user identification
  usePostHogAuth()

  // Get the current streaming form ID and initial prompt from the store
  const {
    formId: currentStreamingFormId,
    initialPrompt,
    setInitialPrompt,
  } = useFormAgentStore()

  // Get initial prompt from URL
  const urlPrompt = searchParams.get("q") || searchParams.get("prompt")

  // Update active form ID when params change
  useEffect(() => {
    const currentFormId = Array.isArray(params.formId)
      ? params.formId[0]
      : params.formId

    if (currentFormId) {
      // Setting active form ID from params
      setActiveFormId(currentFormId)
    } else if (currentStreamingFormId) {
      // Setting active form ID from store
      setActiveFormId(currentStreamingFormId)
    } else {
      // No active form ID found
      setActiveFormId(null)
    }
  }, [params.formId, currentStreamingFormId])

  // Clear initial prompt after it's been used (only for URL-based prompts)
  useEffect(() => {
    if (initialPrompt && activeFormId && urlPrompt) {
      // Only clear URL-based prompts, not dashboard-initiated ones
      // Initial prompt detected from URL (not dashboard navigation)

      // Clear the store prompt after a delay
      const timer = setTimeout(() => {
        // Clearing initial prompt from store
        setInitialPrompt(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [initialPrompt, activeFormId, setInitialPrompt, urlPrompt])

  return <>{children}</>
}
