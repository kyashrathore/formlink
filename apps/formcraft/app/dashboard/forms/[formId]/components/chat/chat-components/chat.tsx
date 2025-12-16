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
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@formlink/ui/ai-elements"
import { X } from "lucide-react"
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
  selectionContext?: any
  onClearSelection?: () => void
}

export function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  isSubmitting,
  selectedModel,
  onSelectModel,
  status,
  selectionContext,
  onClearSelection,
}: ChatComposerProps) {
  const handleSubmit = useCallback(
    (_message: unknown, e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
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
      {selectionContext && (
        <PromptInputHeader>
          <div className="flex w-full items-center justify-between px-1">
            <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50/50 px-2 py-1 text-xs text-blue-600">
              <span>
                <span className="font-medium">{selectionContext.tagName}</span>{" "}
                {selectionContext.componentName && (
                  <span className="font-normal text-blue-400">
                    ({selectionContext.componentName})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={onClearSelection}
                className="ml-1 rounded-sm p-0.5 text-blue-400 transition-colors hover:bg-blue-100/50 hover:text-blue-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </PromptInputHeader>
      )}
      <PromptInputTextarea
        placeholder={
          selectionContext
            ? "Describe changes..."
            : "Ask me anything about forms..."
        }
        className="min-h-[44px] bg-transparent text-base leading-[1.3] sm:text-base md:text-base"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          onValueChange(e.target.value)
        }
      />
      <PromptInputFooter className="w-full justify-between px-3 py-2">
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
      </PromptInputFooter>
    </PromptInput>
  )
}

// Wrapper component to match the expected interface
type ChatProps = {
  onSubmit?: (input: string, selectedModel: string) => void
  isLoading?: boolean
  showSuggestions?: boolean
  initialModel?: string
  onModelChange?: (model: string) => void
  value?: string
  onInputChange?: (value: string) => void
  selectionContext?: any
  onClearSelection?: () => void
}

export default function Chat({
  onSubmit,
  isLoading,
  showSuggestions,
  onInputChange,
  initialModel,
  onModelChange,
  value: externalValue,
  selectionContext,
  onClearSelection,
}: ChatProps) {
  const [internalInput, setInternalInput] = useState("")
  // Use external value if provided, otherwise internal state
  const input = externalValue !== undefined ? externalValue : internalInput
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
    // Clear input
    if (externalValue === undefined) {
      setInternalInput("")
    } else {
      // If controlled, parent handles clearing via onSubmit usually,
      // but here we might need to notify parent to clear.
      // For now, let's assume parent clears it or we call onInputChange("")
      onInputChange?.("")
    }
  }, [input, selectedModel, onSubmit, isLoading, externalValue, onInputChange])

  const handleInputChange = useCallback(
    (value: string) => {
      if (externalValue === undefined) {
        setInternalInput(value)
      }
      onInputChange?.(value)
    },
    [onInputChange, externalValue]
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
      onSelectSystemPrompt={() => {}}
      stop={() => {}}
      selectionContext={selectionContext}
      onClearSelection={onClearSelection}
    />
  )
}
