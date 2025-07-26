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

  useAuth()

  usePostHogAuth()

  const {
    formId: currentStreamingFormId,
    initialPrompt,
    setInitialPrompt,
  } = useFormAgentStore()

  const urlPrompt = searchParams.get("q") || searchParams.get("prompt")

  useEffect(() => {
    const currentFormId = Array.isArray(params.formId)
      ? params.formId[0]
      : params.formId

    if (currentFormId) {
      setActiveFormId(currentFormId)
    } else if (currentStreamingFormId) {
      setActiveFormId(currentStreamingFormId)
    } else {
      setActiveFormId(null)
    }
  }, [params.formId, currentStreamingFormId])

  useEffect(() => {
    if (initialPrompt && activeFormId && urlPrompt) {
      const timer = setTimeout(() => {
        setInitialPrompt(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [initialPrompt, activeFormId, setInitialPrompt, urlPrompt])

  return <>{children}</>
}
