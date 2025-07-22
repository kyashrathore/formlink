"use client"

import { ToggleGroup, ToggleGroupItem } from "@formlink/ui"

export type FormMode = "chat" | "typeform"

interface FormModeControlsProps {
  formMode: FormMode
  onFormModeChange: (mode: FormMode) => void
  className?: string
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
]

export default function FormModeControls({
  formMode,
  onFormModeChange,
  className = "",
}: FormModeControlsProps) {
  return (
    <ToggleGroup
      type="single"
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
