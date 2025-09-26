"use client"

import { MODEL_DEFAULT, MODELS_OPTIONS } from "@/app/lib/config"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formlink/ui"
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptSuggestion,
} from "@formlink/ui/ai-elements"
import { useCallback, useState } from "react"

interface DashboardChatProps {
  onSubmit: (message: string, selectedModel: string) => void
  isNavigating?: boolean
}

const suggestions = [
  "Lead gen form for a marketing agency",
  "Anonymous employee satisfaction survey",
  "Feedback form for a food delivery app",
  "Diwali party registration form",
  "Market research for eco-friendly products",
]

function Chat({
  onSubmit,
  isLoading,
  showSuggestions,
  onInputChange,
}: {
  onSubmit?: (input: string, selectedModel: string) => void
  isLoading?: boolean
  showSuggestions?: boolean
  onInputChange?: (input: string) => void
}) {
  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState(MODEL_DEFAULT)

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
        await onSubmit(input, selectedModel)
      }
      setInput("")
    },
    [input, selectedModel, isLoading, onSubmit]
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
          <PromptInputToolbar className="w-full justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="text-muted-foreground w-auto border-none bg-transparent text-xs shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  {MODELS_OPTIONS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PromptInputTools>
              <PromptInputSubmit
                className="h-8 w-8 cursor-pointer rounded-full transition-all duration-300 ease-out"
                disabled={!input.trim() || isLoading}
              />
            </PromptInputTools>
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
    (message: string, model: string) => {
      onSubmit(message, model)
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
