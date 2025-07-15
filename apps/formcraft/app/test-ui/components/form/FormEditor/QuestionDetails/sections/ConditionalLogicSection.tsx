import { Question } from "@formlink/schema"
import { Button } from "@formlink/ui"
import { Plus } from "lucide-react"
import React from "react"
import { AddItemInput } from "../components/AddItemInput"
import { DeletableBadge } from "../components/DeletableBadge"
import { SectionHeader } from "../components/SectionHeader"
import { BUTTON_CLASSES, InputType, SECTION_ICONS } from "../constants"

interface ConditionalLogicSectionProps {
  question: Question
  visibleInput: InputType
  setVisibleInput: (value: InputType) => void
  onAddCondition: (value: string) => void
  onDeleteCondition: (index: number) => void
  conditionInputRef: React.RefObject<HTMLInputElement | null>
  loading: boolean
  hasValidations: boolean
  shouldHideControls?: boolean
}

export const ConditionalLogicSection: React.FC<
  ConditionalLogicSectionProps
> = ({
  question,
  visibleInput,
  setVisibleInput,
  onAddCondition,
  onDeleteCondition,
  conditionInputRef,
  loading,
  hasValidations,
  shouldHideControls = false,
}) => {
  if (question.conditionalLogic === undefined) return null

  const hasConditionalLogic =
    question.readableConditionalLogic &&
    question.readableConditionalLogic.length > 0
  const showAddButton =
    visibleInput !== "condition" && (hasValidations || hasConditionalLogic)

  return (
    <div>
      {hasConditionalLogic && (
        <>
          <SectionHeader
            icon={SECTION_ICONS.conditionalLogic}
            title="Conditional Logic"
          />
          <DeletableBadge
            items={question.readableConditionalLogic}
            onDelete={onDeleteCondition}
            variant="outline"
          />
        </>
      )}

      {!shouldHideControls && showAddButton && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setVisibleInput("condition")
            setTimeout(() => conditionInputRef.current?.focus(), 0)
          }}
          className={BUTTON_CLASSES.addButton}
        >
          <Plus size={14} className="mr-1" /> Add Condition
        </Button>
      )}

      {visibleInput === "condition" && (
        <AddItemInput
          placeholder="Add condition..."
          onAdd={onAddCondition}
          buttonLabel="Add Condition"
          inputRef={conditionInputRef}
          loading={loading}
        />
      )}
    </div>
  )
}
