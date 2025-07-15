"use client"

import ChatPanel from "./chat/ChatPanel"

interface ChatTabContentProps {
  userId: string | null
  formId: string
}

export default function ChatTabContent({
  userId,
  formId,
}: ChatTabContentProps) {
  // Use the formId passed from parent (no longer need hardcoded fallback)

  return (
    <ChatPanel
      formId={formId}
      userId={userId || undefined}
      showSuggestions={true}
      initialMessage={undefined}
    />
  )
}
