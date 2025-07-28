"use client"

import { useAuth } from "@/app/hooks/useAuth"
import { usePostHogAuth } from "@/app/hooks/usePostHogAuth"
import { useFormGenerationStore } from "@/app/stores/formGenerationStore"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

interface DashboardLayoutClientProps {
  children: React.ReactNode
}

export default function DashboardLayoutClient({
  children,
}: DashboardLayoutClientProps) {
  const params = useParams()
  const [, setActiveFormId] = useState<string | null>(null)

  useAuth()

  usePostHogAuth()

  const { formId: currentStreamingFormId } = useFormGenerationStore()

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

  // Note: initialPrompt functionality removed as it's not in the new store
  // This effect is no longer needed

  return <>{children}</>
}
