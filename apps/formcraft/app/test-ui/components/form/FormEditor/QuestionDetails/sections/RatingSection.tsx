import { EditableQuestionField, Question } from "@formlink/schema"
import React from "react"
import InlineEditableField from "../../InlineEditableField"
import { SECTION_ICONS } from "../constants"

interface RatingSectionProps {
  question: Question
  onFieldUpdate: (field: EditableQuestionField, value: string) => void
}

export const RatingSection: React.FC<RatingSectionProps> = ({
  question,
  onFieldUpdate,
}) => {
  if (
    question.questionType !== "rating" ||
    question.readableRatingConfig === undefined
  ) {
    return null
  }

  const Icon = SECTION_ICONS.rating

  return (
    <div className="mb-8 flex items-baseline">
      <Icon className="mr-4 size-4 text-xs font-semibold" />
      <InlineEditableField
        id={`rating-${question.id}`}
        label="Rating Scale Description"
        defaultValue={question.readableRatingConfig}
        onConfirm={(value) => onFieldUpdate("readableRatingConfig", value)}
        placeholder="Describe rating scale"
        className="flex-grow"
        hideLabel
      />
    </div>
  )
}
