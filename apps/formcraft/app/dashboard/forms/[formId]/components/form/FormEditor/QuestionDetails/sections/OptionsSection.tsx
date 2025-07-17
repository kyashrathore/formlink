import { Question } from "@formlink/schema"
import { Button } from "@formlink/ui"
import { Plus } from "lucide-react"
import React from "react"
import { AddOptionInput } from "../components/AddOptionInput"
import { DeletableBadge } from "../components/DeletableBadge"
import { SectionHeader } from "../components/SectionHeader"
import { BUTTON_CLASSES, InputType, SECTION_ICONS } from "../constants"

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
    (question.questionType === "singleChoice" ||
      question.questionType === "multipleChoice") &&
    question.options !== undefined

  if (!shouldShow) return null

  const hasOptions = question.options && question.options.length > 0

  return (
    <div className="mb-8">
      {hasOptions && (
        <>
          <SectionHeader icon={SECTION_ICONS.options} title="Options" />
          <DeletableBadge
            items={question.options}
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
          variant="outline"
          onClick={() => {
            setVisibleInput("option")
            setTimeout(() => optionInputRef.current?.focus(), 0)
          }}
          className={BUTTON_CLASSES.addButton}
        >
          <Plus size={14} className="mr-1" /> Add Option
        </Button>
      )}

      {visibleInput === "option" && (
        <AddOptionInput
          labelPlaceholder="Option Label..."
          valuePlaceholder="Option Value..."
          onAdd={(option) => {
            onAddOption(option)
            setVisibleInput(null)
          }}
          buttonLabel="Add Option"
          labelInputRef={optionInputRef}
        />
      )}
    </div>
  )
}
