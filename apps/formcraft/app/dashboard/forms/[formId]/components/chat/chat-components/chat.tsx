"use client"

import { MODEL_DEFAULT } from "@/app/lib/config"
import { useCallback, useState } from "react"
import { ChatInput } from "./chat-input"

type ChatProps = {
  onSubmit?: (input: string, selectedModel: string) => void
  isLoading?: boolean
  showSuggestions?: boolean
  onInputChange?: (input: string) => void
}

export default function Chat({
  onSubmit,
  isLoading,
  showSuggestions,
  onInputChange,
}: ChatProps) {
  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState(MODEL_DEFAULT)
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false)

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      onInputChange?.(value)
    },
    [setInput, onInputChange]
  )

  const handleSelectModel = useCallback((model: string) => {
    setSelectedModel(model)
  }, [])

  const submit = async () => {
    if (!input.trim()) return

    setInternalIsSubmitting(true)
    if (onSubmit) {
      await onSubmit(input, selectedModel)
    }
    setInput("")
    setInternalIsSubmitting(false)
  }

  const currentIsSubmitting =
    isLoading !== undefined ? isLoading : internalIsSubmitting

  return (
    <ChatInput
      value={input}
      onValueChange={handleInputChange}
      onSend={submit}
      isSubmitting={currentIsSubmitting}
      files={[]}
      onFileUpload={() => {}}
      onFileRemove={() => {}}
      onSuggestion={() => {}}
      hasSuggestions={showSuggestions ?? false}
      onSelectModel={handleSelectModel}
      selectedModel={selectedModel}
      isUserAuthenticated={false}
      onSelectSystemPrompt={() => {}}
      systemPrompt=""
      stop={() => {}}
      status="ready"
    />
  )
}
