"use client"

import { ToggleGroup, ToggleGroupItem } from "@formlink/ui"

export type FormMode = "chat" | "typeform" | "classic"

interface FormModeControlsProps {
  formMode: FormMode
  onFormModeChange: (mode: FormMode) => void
  className?: string
  size?: "default" | "sm" | "lg"
}

const formModeOptions = [
  {
    mode: "chat" as const,
    label: "Chat",
    description: "Conversational form experience",
  },
  {
    mode: "typeform" as const,
    label: "Typeform",
    description: "Traditional form layout",
  },
  {
    mode: "classic" as const,
    label: "Classic",
    description: "Multi-step form with grid layout",
  },
]

export default function FormModeControls({
  formMode,
  onFormModeChange,
  className = "",
  size = "default",
}: FormModeControlsProps) {
  return (
    <ToggleGroup
      type="single"
      size={size}
      value={formMode}
      onValueChange={(value) => value && onFormModeChange(value as FormMode)}
      className={`${className}`}
    >
      {formModeOptions.map(({ mode, label, description }) => (
        <ToggleGroupItem
          key={mode}
          value={mode}
          aria-label={description}
          title={description}
          className="px-3"
        >
          <span>{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export { formModeOptions }
