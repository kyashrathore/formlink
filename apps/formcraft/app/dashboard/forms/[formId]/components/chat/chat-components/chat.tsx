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
} from "@formlink/ui/ai-elements"
import React, { useCallback, useState } from "react"

type ChatComposerProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  isSubmitting?: boolean
  hasMessages?: boolean
  files: File[]
  onFileUpload: (files: File[]) => void
  onFileRemove: (file: File) => void
  onSuggestion: (suggestion: string) => void
  hasSuggestions?: boolean
  selectedModel: string
  onSelectModel: (model: string) => void
  isUserAuthenticated: boolean
  systemPrompt?: string
  onSelectSystemPrompt: (systemPrompt: string) => void
  stop: () => void
  status?: "submitted" | "streaming" | "ready" | "error"
}

export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  isSubmitting,
  selectedModel,
  onSelectModel,
  status,
}: ChatComposerProps) {
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!value.trim() || isSubmitting) return
      onSubmit()
    },
    [value, isSubmitting, onSubmit]
  )

  const isDisabled = isSubmitting || !value.trim()

  return (
    <PromptInput
      className="border-input bg-popover relative overflow-hidden border p-0 shadow-xs backdrop-blur-xl"
      onSubmit={handleSubmit}
    >
      <PromptInputTextarea
        placeholder="Ask me anything about forms..."
        className="min-h-[44px] bg-transparent text-base leading-[1.3] sm:text-base md:text-base"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          onValueChange(e.target.value)
        }
      />
      <PromptInputToolbar className="w-full justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Model Selection */}
          <Select value={selectedModel} onValueChange={onSelectModel}>
            <SelectTrigger className="text-muted-foreground w-auto border-none bg-transparent text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
            disabled={isDisabled}
            status={status}
            aria-label="Send message"
          />
        </PromptInputTools>
      </PromptInputToolbar>
    </PromptInput>
  )
}

// Wrapper component to match the expected interface
type ChatProps = {
  onSubmit?: (input: string, selectedModel: string) => void
  isLoading?: boolean
  showSuggestions?: boolean
  onInputChange?: (input: string) => void
  initialModel?: string
  onModelChange?: (model: string) => void
}

export default function Chat({
  onSubmit,
  isLoading,
  showSuggestions,
  onInputChange,
  initialModel,
  onModelChange,
}: ChatProps) {
  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState(
    initialModel || MODEL_DEFAULT
  )
  React.useEffect(() => {
    if (initialModel && initialModel !== selectedModel) {
      setSelectedModel(initialModel)
    }
  }, [initialModel, selectedModel])

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isLoading) return
    onSubmit?.(input, selectedModel)
    setInput("")
  }, [input, selectedModel, onSubmit, isLoading])

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      onInputChange?.(value)
    },
    [onInputChange]
  )

  return (
    <ChatComposer
      value={input}
      onValueChange={handleInputChange}
      onSubmit={handleSubmit}
      isSubmitting={isLoading}
      selectedModel={selectedModel}
      onSelectModel={(m) => {
        setSelectedModel(m)
        onModelChange?.(m)
      }}
      status={isLoading ? "streaming" : "ready"}
      // These props are not used in the current implementation
      hasMessages={false}
      files={[]}
      onFileUpload={() => {}}
      onFileRemove={() => {}}
      onSuggestion={() => {}}
      hasSuggestions={showSuggestions}
      isUserAuthenticated={true}
      systemPrompt=""
      onSelectSystemPrompt={() => {}}
      stop={() => {}}
    />
  )
}
