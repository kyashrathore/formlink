"use client"

import {
  Button,
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
  PromptSuggestion,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formlink/ui"
import { ArrowUp } from "@phosphor-icons/react/ArrowUp"
import { Stop } from "@phosphor-icons/react/Stop"
import React, { useCallback } from "react"
import { Model, MODEL_DEFAULT, MODELS_OPTIONS } from "../../lib/config"

type ChatInputProps = {
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  isSubmitting?: boolean
  hasMessages?: boolean
  files: File[]
  onFileUpload: (files: File[]) => void
  onFileRemove: (file: File) => void
  onSuggestion: (suggestion: string) => void
  hasSuggestions?: boolean
  onSelectModel: (model: string) => void
  selectedModel: string
  isUserAuthenticated: boolean
  onSelectSystemPrompt: (systemPrompt: string) => void
  systemPrompt?: string
  stop: () => void
  status?: "submitted" | "streaming" | "ready" | "error"
}

export function ChatInput({
  value,
  onValueChange,
  onSend,
  isSubmitting,
  files,
  onFileUpload,
  onFileRemove,
  selectedModel,
  onSelectModel,
  isUserAuthenticated,
  stop,
  status,
  hasSuggestions,
}: ChatInputProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSubmitting) return

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        onSend()
      }
    },
    [onSend, isSubmitting]
  )

  const handleMainClick = () => {
    if (isSubmitting && status !== "streaming") {
      return
    }

    if (isSubmitting && status === "streaming") {
      stop()
      return
    }

    onSend()
  }

  // Initial suggestions for form creation
  const initialFormPrompts = [
    "Quick contact form (Name, Email)?",
    "Survey: 'Coffee vs Tea' poll ☕🍵",
    "Fun quiz: 3 quick questions!",
    "Event sign-up form (easy RSVP)",
    "Need a job form? (CV upload ready)",
  ]

  return (
    <div className="relative z-60 flex w-full flex-col items-center">
      {/* Chat Input Area */}
      <div className="relative w-full max-w-3xl">
        <PromptInput
          className="border-input bg-popover focus-within:ring-ring relative z-10 overflow-hidden border p-0 pb-2 shadow-lg backdrop-blur-xl focus-within:ring-2"
          maxHeight={48}
          value={value}
          onValueChange={onValueChange}
        >
          <PromptInputTextarea
            placeholder={`Ask anything about form`}
            onKeyDown={handleKeyDown}
            className="mt-2 ml-2 min-h-[44px] text-base leading-[1.3] sm:text-base md:text-base"
            disabled={isSubmitting}
          />
          <PromptInputActions className="mt-5 w-full justify-between gap-2 px-2">
            <div className="flex items-center gap-2">
              <Select
                value={selectedModel ?? MODEL_DEFAULT}
                onValueChange={onSelectModel}
              >
                <SelectTrigger className="h-9 w-[220px] rounded-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent className="rounded-md">
                  {MODELS_OPTIONS.map((model: Model) => (
                    <SelectItem
                      key={model.id}
                      value={model.id}
                      disabled={model.available === false}
                    >
                      <span className="flex items-center gap-2">
                        {model.icon ? (
                          // @ts-ignore: model.icon is a React component
                          <model.icon className="h-4 w-4" />
                        ) : null}
                        {model.name}
                        {model.available === false && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            (coming soon)
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PromptInputAction tooltip={isSubmitting ? "Sending..." : "Send"}>
              <Button
                size="sm"
                className="h-9 w-9 cursor-pointer rounded-full transition-all duration-300 ease-out"
                disabled={isSubmitting || (status !== "streaming" && !value)}
                type="button"
                onClick={handleMainClick}
                aria-label="Send message"
              >
                {status === "streaming" ? (
                  <Stop className="size-4" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
        {/* Suggestions absolutely positioned below input, do not affect input vertical position */}
        {!value && hasSuggestions && (
          <div className="absolute top-full right-0 left-0 z-20 mt-2 flex w-full flex-wrap gap-2 px-1">
            {initialFormPrompts.map((prompt, index) => (
              <PromptSuggestion
                key={index}
                onClick={() => onValueChange(prompt)}
              >
                {prompt}
              </PromptSuggestion>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
