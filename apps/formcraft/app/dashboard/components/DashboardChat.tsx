"use client"

import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptSuggestion,
} from "@formlink/ui/ai-elements"
import { useCallback, useState } from "react"

interface DashboardChatProps {
  onSubmit: (message: string) => void
  isNavigating?: boolean
}

const suggestions = [
  "Quick contact form (Name, Email)?",
  "Survey: 'Coffee vs Tea' poll",
  "Fun quiz: 3 quick questions!",
  "Event registration with RSVP",
  "Customer feedback form",
]

function Chat({
  onSubmit,
  isLoading,
  showSuggestions,
  onInputChange,
}: {
  onSubmit?: (input: string) => void
  isLoading?: boolean
  showSuggestions?: boolean
  onInputChange?: (input: string) => void
}) {
  const [input, setInput] = useState("")

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      onInputChange?.(value)
    },
    [onInputChange]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault() // Prevent default form submission

      if (!input.trim() || isLoading) return

      if (onSubmit) {
        await onSubmit(input)
      }
      setInput("")
    },
    [input, isLoading, onSubmit]
  )

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    onInputChange?.(suggestion)
  }

  return (
    <div className="relative z-60 flex w-full flex-col items-center">
      <div className="relative w-full max-w-3xl">
        <PromptInput className="min-h-20" onSubmit={handleSubmit}>
          <PromptInputTextarea
            placeholder="Ask anything about forms..."
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            className="mt-2 ml-2 min-h-[44px] text-base leading-[1.3] sm:text-base md:text-base"
            disabled={isLoading}
          />
          <PromptInputToolbar>
            <PromptInputSubmit
              className="absolute right-1 bottom-1"
              disabled={!input.trim() || isLoading}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
      {showSuggestions && !input && (
        <div className="mt-4 flex w-full max-w-3xl flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <PromptSuggestion
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              variant="outline"
              size="sm"
            >
              {suggestion}
            </PromptSuggestion>
          ))}
        </div>
      )}
    </div>
  )
}

export function DashboardChat({ onSubmit, isNavigating }: DashboardChatProps) {
  const handleSubmit = useCallback(
    (message: string) => {
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
          onInputChange={() => {}}
        />
      </div>
    </div>
  )
}
