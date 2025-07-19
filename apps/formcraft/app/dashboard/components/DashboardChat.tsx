"use client"

import Chat from "@/app/components/chat/chat"
import { useCallback } from "react"

interface DashboardChatProps {
  onSubmit: (message: string) => void
  isNavigating?: boolean
}

export function DashboardChat({ onSubmit, isNavigating }: DashboardChatProps) {
  const handleSubmit = useCallback(
    (message: string, _model: string) => {
      // Ignore model parameter for dashboard, just pass the message
      onSubmit(message)
    },
    [onSubmit]
  )

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <Chat
          onSubmit={handleSubmit}
          isLoading={isNavigating}
          showSuggestions={true}
          onInputChange={() => {}} // No need to track input changes on dashboard
        />
      </div>
    </div>
  )
}
