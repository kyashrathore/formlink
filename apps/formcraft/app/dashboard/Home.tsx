"use client"

import { analytics } from "@/app/lib/analytics"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { startTransition, useCallback, useEffect, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { DashboardChat } from "./components/DashboardChat"
import { FormCreationModal } from "./components/FormCreationModal"
import { FormWithVersions } from "./types"

interface User {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
  [key: string]: unknown
}

export default function HomeWrapper({
  user,
  forms,
}: {
  user: User | null
  forms: FormWithVersions[]
}) {
  return <Home forms={forms} user={user} />
}

interface HomeProps {
  forms: FormWithVersions[]
  user: User | null
}

function Home({ forms, user }: HomeProps) {
  const router = useRouter()
  const [formIdForAgentPanel, setFormIdForAgentPanel] = useState<string | null>(
    null
  )
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    // Create a new form ID when component mounts
    const newFormId = uuidv4()
    setFormIdForAgentPanel(newFormId)
  }, [])

  const handleStartFormCreation = useCallback(
    (message: string, model: string) => {
      if (!formIdForAgentPanel) return

      setIsNavigating(true)
      analytics.formCreationStarted("ai_chat")
      startTransition(() => {
        const url = `/dashboard/forms/${formIdForAgentPanel}?initialPrompt=${encodeURIComponent(
          message
        )}&model=${encodeURIComponent(model)}`
        router.push(url)
      })
    },
    [formIdForAgentPanel, router]
  )

  const handleStartManualCreation = useCallback(
    (mode: "chat" | "classic" | "typeform") => {
      if (!formIdForAgentPanel) return

      if (mode === "chat") {
        setIsCreationModalOpen(false)
        return // Just close modal, let them type
      }

      setIsNavigating(true)
      const analyticsEvent =
        mode === "classic" ? "manual_classic" : "manual_typeform"
      analytics.formCreationStarted(analyticsEvent)

      startTransition(() => {
        const url = `/dashboard/forms/${formIdForAgentPanel}?mode=${mode}`
        router.push(url)
      })
    },
    [formIdForAgentPanel, router]
  )

  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false)

  return (
    <motion.div
      className="flex h-full w-full flex-col"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="flex h-full w-full max-w-4xl flex-col items-center justify-center gap-6">
          <DashboardChat
            onSubmit={handleStartFormCreation}
            isNavigating={isNavigating}
          />
          <button
            onClick={() => setIsCreationModalOpen(true)}
            className="text-muted-foreground hover:text-foreground text-sm hover:underline"
          >
            Or create manually...
          </button>
        </div>
      </div>

      <FormCreationModal
        isOpen={isCreationModalOpen}
        onClose={() => setIsCreationModalOpen(false)}
        onSelectMode={handleStartManualCreation}
      />
    </motion.div>
  )
}
