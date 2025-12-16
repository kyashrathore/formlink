import { Question } from "@formlink/schema"
import { Button } from "@formlink/ui"
import { Plus } from "lucide-react"
import React from "react"
import { DeletableBadge } from "../components/DeletableBadge"
import { SectionHeader } from "../components/SectionHeader"
import { InputType, SECTION_ICONS } from "../constants"

interface OptionsSectionProps {
  question: Question
  visibleInput: InputType
  setVisibleInput: (value: InputType) => void
  onAddOption: (option: { label: string; value: string }) => void
  onDeleteOption: (index: number) => void
  optionInputRef: React.RefObject<HTMLInputElement | null>
}

export const OptionsSection: React.FC<OptionsSectionProps> = ({
  question,
  visibleInput,
  setVisibleInput,
  onAddOption,
  onDeleteOption,
  optionInputRef,
}) => {
  const shouldShow =
    (question.type.name === "singleChoice" ||
      question.type.name === "multipleChoice") &&
    "options" in question.type &&
    question.type.options !== undefined

  if (!shouldShow) return null

  const options = "options" in question.type ? question.type.options : []
  const hasOptions = options && options.length > 0

  return (
    <div className="mb-8">
      {hasOptions && (
        <>
          <SectionHeader icon={SECTION_ICONS.options} title="Options" />
          <DeletableBadge
            items={options}
            onDelete={onDeleteOption}
            variant="outline"
            isOption={true}
          />
        </>
      )}

      {visibleInput !== "option" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setVisibleInput("option")
            setTimeout(() => optionInputRef.current?.focus(), 0)
          }}
          className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs font-normal"
        >
          <Plus size={14} className="mr-1" /> Add Option
        </Button>
      )}

      {visibleInput === "option" && (
        <div className="flex items-center gap-2">
          <input
            ref={optionInputRef}
            type="text"
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-8 w-full rounded-md border px-3 py-1 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Option label..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = e.currentTarget.value.trim()
                if (val) {
                  onAddOption({ label: val, value: val })
                  e.currentTarget.value = ""
                  // Keep focus to add multiple
                } else {
                  setVisibleInput(null)
                }
              }
              if (e.key === "Escape") {
                setVisibleInput(null)
              }
            }}
            onBlur={(e) => {
              const val = e.currentTarget.value.trim()
              if (val) {
                onAddOption({ label: val, value: val })
              }
              setVisibleInput(null)
            }}
          />
        </div>
      )}
    </div>
  )
}
