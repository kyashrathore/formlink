"use client"

import { useFormGenerationStore } from "../stores/useFormGenerationStore"
import ChatPanel from "./chat/ChatPanel"

interface ChatTabContentProps {
  userId: string | null
  formId: string
}

export default function ChatTabContent({
  userId,
  formId,
}: ChatTabContentProps) {
  const initialPrompt = useFormGenerationStore((state) => state.initialPrompt)

  return (
    <ChatPanel
      formId={formId}
      userId={userId || undefined}
      showSuggestions={true}
      initialMessage={initialPrompt || undefined}
    />
  )
}
