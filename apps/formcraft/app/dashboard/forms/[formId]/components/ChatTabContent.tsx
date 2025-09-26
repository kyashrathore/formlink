"use client"

import { useFormGenerationStore } from "../stores/useFormGenerationStore"
import ChatPanel from "./chat/ChatPanel"

interface ChatTabContentProps {
  userId: string | null
  formId: string
  initialModel?: string
}

export default function ChatTabContent({
  userId,
  formId,
  initialModel,
}: ChatTabContentProps) {
  const initialPrompt = useFormGenerationStore((state) => state.initialPrompt)

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ChatPanel
          formId={formId}
          userId={userId || undefined}
          initialMessage={initialPrompt || undefined}
          initialModel={initialModel}
        />
      </div>
    </div>
  )
}
