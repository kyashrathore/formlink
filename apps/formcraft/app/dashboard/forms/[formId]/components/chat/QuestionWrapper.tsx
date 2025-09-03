import React from "react"

interface QuestionWrapperProps {
  questionId: string
  messageId: string
  isLast?: boolean
  variant: "user" | "assistant"
  handleFileUpload?: (questionId: string, file: File) => Promise<void>
  onSubmitSelection?: (
    questionId: string,
    value: any,
    displayText: string
  ) => Promise<void>
}

// TODO: Implement the QuestionWrapper component for formcraft
// This is a placeholder that will be replaced with actual form question rendering logic
export const QuestionWrapper: React.FC<QuestionWrapperProps> = ({
  questionId,
  messageId,
  isLast,
  variant,
  handleFileUpload,
  onSubmitSelection,
}) => {
  // For now, just render a placeholder
  // This will be replaced with actual question rendering logic from formcraft's context
  return (
    <div className="bg-muted/50 rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">
        Form Question: {questionId}
      </p>
    </div>
  )
}
