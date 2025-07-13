"use client"

import { cn } from "@/app/lib"
import { Button } from "@formlink/ui"
import { Send, Sparkles } from "lucide-react"
import React, { KeyboardEvent, useEffect, useRef, useState } from "react"

interface InlineChatInputProps {
  onSubmit: (prompt: string) => void
  disabled?: boolean
  className?: string
  value?: string
  onChange?: (value: string) => void
}

export function InlineChatInput({
  onSubmit,
  disabled,
  className,
  value,
  onChange,
}: InlineChatInputProps) {
  const [internalValue, setInternalValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isControlled = value !== undefined
  const inputValue = isControlled ? value : internalValue

  const handleChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
  }

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "48px"
      const scrollHeight = textarea.scrollHeight
      textarea.style.height = Math.min(scrollHeight, 120) + "px"
    }
  }, [inputValue])

  // Auto-focus on mount and when disabled state changes
  useEffect(() => {
    if (!disabled) {
      // Use a small delay to ensure the component is fully mounted
      const timer = setTimeout(() => {
        if (textareaRef.current && !disabled) {
          textareaRef.current.focus()
          // Also set cursor position to end of text if there's existing value
          if (inputValue) {
            textareaRef.current.setSelectionRange(
              inputValue.length,
              inputValue.length
            )
          }
        }
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [disabled, inputValue]) // Re-run when disabled changes

  const handleSubmit = () => {
    if (inputValue.trim() && !disabled) {
      onSubmit(inputValue.trim())
      // Don't clear the input here - let the parent component handle it after navigation
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-2xl transition-all duration-300",
        isFocused && "scale-[1.02]",
        className
      )}
    >
      {/* Gradient background for emphasis */}
      <div className="from-primary/5 via-primary/10 to-primary/5 absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r blur-xl" />
      <div
        className={cn(
          "bg-background/95 relative flex items-end gap-2 rounded-2xl border-2 p-2 shadow-lg backdrop-blur-sm transition-all duration-300",
          isFocused
            ? "border-primary ring-primary/20 shadow-xl ring-2"
            : "border-muted-foreground/30 hover:border-muted-foreground/50",
          disabled && "opacity-50"
        )}
      >
        <div className="bg-background absolute -top-3 left-4 px-2">
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            AI-Powered Form Builder
          </span>
        </div>

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Create a customer feedback form with ratings and comments"
          disabled={disabled}
          rows={1}
          autoFocus
          aria-label="Describe the form you want to create"
          className={cn(
            "placeholder:text-muted-foreground flex-1 resize-none bg-transparent px-4 py-3 text-base outline-none",
            "overflow-hidden"
          )}
          style={{
            minHeight: "48px",
            maxHeight: "120px",
          }}
        />

        <Button
          onClick={handleSubmit}
          disabled={!inputValue.trim() || disabled}
          size="icon"
          className="h-10 w-10 rounded-xl"
          aria-label="Start creating form"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 text-center">
        <p className="text-muted-foreground text-sm">
          No sign-up required • Start building immediately
        </p>
      </div>
    </div>
  )
}
