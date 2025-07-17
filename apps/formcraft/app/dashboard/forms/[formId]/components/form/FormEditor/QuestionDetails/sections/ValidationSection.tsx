import { Question } from "@formlink/schema"
import { Button } from "@formlink/ui"
import { Plus } from "lucide-react"
import React from "react"
import { AddItemInput } from "../components/AddItemInput"
import { DeletableBadge } from "../components/DeletableBadge"
import { SectionHeader } from "../components/SectionHeader"
import { BUTTON_CLASSES, InputType, SECTION_ICONS } from "../constants"

interface ValidationSectionProps {
  question: Question
  visibleInput: InputType
  setVisibleInput: (value: InputType) => void
  onAddValidation: (value: string) => void
  onDeleteValidation: (index: number) => void
  validationInputRef: React.RefObject<HTMLInputElement | null>
  loading: boolean
  hasConditionalLogic: boolean
  shouldHideControls?: boolean
}

export const ValidationSection: React.FC<ValidationSectionProps> = ({
  question,
  visibleInput,
  setVisibleInput,
  onAddValidation,
  onDeleteValidation,
  validationInputRef,
  loading,
  hasConditionalLogic,
  shouldHideControls = false,
}) => {
  if (question.validations === undefined) return null

  const hasValidations =
    question.readableValidations && question.readableValidations.length > 0
  const showAddButton = visibleInput !== "validation"
  const showBothButtons = !hasValidations && !hasConditionalLogic
  const showSingleButton = hasValidations || hasConditionalLogic

  return (
    <div className="mb-4">
      {hasValidations && (
        <>
          <SectionHeader icon={SECTION_ICONS.validations} title="Validations" />
          <DeletableBadge
            items={question.readableValidations}
            onDelete={onDeleteValidation}
            variant="outline"
          />
        </>
      )}

      {!shouldHideControls && showAddButton && showBothButtons && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setVisibleInput("validation")
              setTimeout(() => validationInputRef.current?.focus(), 0)
            }}
            className={BUTTON_CLASSES.addButton}
          >
            <Plus size={14} className="mr-1" /> Add Rule
          </Button>
          {question.conditionalLogic !== undefined &&
            visibleInput !== "condition" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setVisibleInput("condition")
                }}
                className={BUTTON_CLASSES.addButton}
              >
                <Plus size={14} className="mr-1" /> Add Condition
              </Button>
            )}
        </div>
      )}

      {!shouldHideControls && showAddButton && showSingleButton && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setVisibleInput("validation")
            setTimeout(() => validationInputRef.current?.focus(), 0)
          }}
          className={BUTTON_CLASSES.addButton}
        >
          <Plus size={14} className="mr-1" /> Add Rule
        </Button>
      )}

      {visibleInput === "validation" && (
        <AddItemInput
          placeholder="Add validation rule..."
          onAdd={onAddValidation}
          buttonLabel="Add Rule"
          inputRef={validationInputRef}
          loading={loading}
        />
      )}
    </div>
  )
}
