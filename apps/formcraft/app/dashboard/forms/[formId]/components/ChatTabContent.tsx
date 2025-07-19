"use client"

import { useFormAgentStore } from "@/app/stores/formAgentStore"
import ChatPanel from "./chat/ChatPanel"

interface ChatTabContentProps {
  userId: string | null
  formId: string
}

export default function ChatTabContent({
  userId,
  formId,
}: ChatTabContentProps) {
  // Get initial prompt from the global store
  const initialPrompt = useFormAgentStore((state) => state.initialPrompt)

  return (
    <ChatPanel
      formId={formId}
      userId={userId || undefined}
      showSuggestions={true}
      initialMessage={initialPrompt || undefined}
    />
  )
}
