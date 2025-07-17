"use client"

import { Card, CardContent } from "@formlink/ui"
import React, { useEffect, useRef, useState } from "react"
import { useMobile } from "../../../hooks/use-mobile"
import {
  ConditionalLogicSection,
  InputType,
  OptionsSection,
  QuestionDetailProps,
  QuestionHeader,
  RatingSection,
  useAIOperations,
  useQuestionHandlers,
  ValidationSection,
} from "./QuestionDetails/index"

const QuestionDetail: React.FC<QuestionDetailProps> = ({
  question,
  userId,
  selectedTab,
}) => {
  const [visibleInput, setVisibleInput] = useState<InputType>(null)
  const isMobile = useMobile()
  const shouldHideControls = isMobile && selectedTab === "content"

  const optionInputRef = useRef<HTMLInputElement>(null)
  const validationInputRef = useRef<HTMLInputElement>(null)
  const conditionInputRef = useRef<HTMLInputElement>(null)

  const {
    form,
    handleFieldUpdate,
    handleAddOption,
    handleDeleteOption,
    handleDeleteValidation,
    handleDeleteCondition,
    handleDuplicateQuestion,
    handleDeleteQuestion,
    addQuestionValidation,
    addQuestionCondition,
  } = useQuestionHandlers(question)

  const {
    handleAddValidation,
    handleAddCondition,
    aiValidationLoading,
    aiConditionLoading,
  } = useAIOperations({
    question,
    userId,
    form,
    addQuestionValidation,
    addQuestionCondition,
    setVisibleInput: () => setVisibleInput(null),
  })

  useEffect(() => {
    setVisibleInput(null)
  }, [question?.id])

  if (!question) {
    return (
      <Card className="flex h-full items-center justify-center border-dashed">
        <CardContent className="text-muted-foreground text-center">
          <p>Select a question from the list to see its details.</p>
        </CardContent>
      </Card>
    )
  }

  const hasValidations = Boolean(
    question.readableValidations && question.readableValidations.length > 0
  )
  const hasConditionalLogic = Boolean(
    question.readableConditionalLogic &&
      question.readableConditionalLogic.length > 0
  )

  return (
    <div className="group relative text-sm">
      <div className="space-y-3">
        <QuestionHeader
          question={question}
          onFieldUpdate={handleFieldUpdate}
          onDuplicate={handleDuplicateQuestion}
          onDelete={handleDeleteQuestion}
          shouldHideControls={shouldHideControls}
        />

        <OptionsSection
          question={question}
          visibleInput={visibleInput}
          setVisibleInput={setVisibleInput}
          onAddOption={handleAddOption}
          onDeleteOption={handleDeleteOption}
          optionInputRef={optionInputRef}
        />

        <RatingSection question={question} onFieldUpdate={handleFieldUpdate} />

        <ValidationSection
          question={question}
          visibleInput={visibleInput}
          setVisibleInput={setVisibleInput}
          onAddValidation={handleAddValidation}
          onDeleteValidation={handleDeleteValidation}
          validationInputRef={validationInputRef}
          loading={aiValidationLoading}
          hasConditionalLogic={hasConditionalLogic}
          shouldHideControls={shouldHideControls}
        />

        <ConditionalLogicSection
          question={question}
          visibleInput={visibleInput}
          setVisibleInput={setVisibleInput}
          onAddCondition={handleAddCondition}
          onDeleteCondition={handleDeleteCondition}
          conditionInputRef={conditionInputRef}
          loading={aiConditionLoading}
          hasValidations={hasValidations}
          shouldHideControls={shouldHideControls}
        />
      </div>
    </div>
  )
}

export default QuestionDetail
