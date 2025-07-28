"use client"

import { Card, CardContent } from "@formlink/ui"
import React, { useEffect, useRef, useState } from "react"
import { useMobile } from "../../../hooks/use-mobile"
import {
  InputType,
  OptionsSection,
  QuestionDetailProps,
  QuestionHeader,
  RatingSection,
  useQuestionHandlers,
} from "./QuestionDetails/index"

const QuestionDetail: React.FC<QuestionDetailProps> = ({
  question,
  selectedTab,
}) => {
  const [visibleInput, setVisibleInput] = useState<InputType>(null)
  const isMobile = useMobile()
  const shouldHideControls = isMobile && selectedTab === "content"

  const optionInputRef = useRef<HTMLInputElement>(null)

  const {
    handleFieldUpdate,
    handleAddOption,
    handleDeleteOption,
    handleDuplicateQuestion,
    handleDeleteQuestion,
  } = useQuestionHandlers(question)

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
      </div>
    </div>
  )
}

export default QuestionDetail
