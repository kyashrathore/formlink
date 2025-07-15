import { cn } from "@/app/lib"
import { useSortable } from "@dnd-kit/sortable"
import { EditableQuestionField, Question } from "@formlink/schema"
import { Button } from "@formlink/ui"
import { Copy, GripVertical, Trash2 } from "lucide-react"
import React from "react"
import InlineEditableField from "../../InlineEditableField"
import { BUTTON_CLASSES } from "../constants"

interface QuestionHeaderProps {
  question: Question
  onFieldUpdate: (field: EditableQuestionField, value: string) => void
  onDuplicate: () => void
  onDelete: () => void
  shouldHideControls?: boolean
  isPublishedMode?: boolean
}

export const QuestionHeader: React.FC<QuestionHeaderProps> = ({
  question,
  onFieldUpdate,
  onDuplicate,
  onDelete,
  shouldHideControls = false,
  isPublishedMode,
}) => {
  const { attributes, listeners } = useSortable({
    id: question.id,
    disabled: isPublishedMode,
  })
  return (
    <div className="mb-4 flex-col items-start justify-between">
      <div className="text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            {...(!isPublishedMode ? attributes : {})}
            {...(!isPublishedMode ? listeners : {})}
            className={cn(
              "text-muted-foreground hover:text-foreground flex items-center p-1",
              isPublishedMode
                ? "cursor-not-allowed opacity-50"
                : "cursor-grab active:cursor-grabbing"
            )}
            title={
              isPublishedMode
                ? "Reordering disabled for published forms"
                : "Drag to reorder"
            }
          >
            <GripVertical className="size-4" />
          </div>
          <span className="mr-2">ID: {question.id}</span>
          <span className="mr-2">Type: {question.questionType}</span>
        </div>
        {!shouldHideControls && (
          <div className="opacity-0 transition-opacity duration-200 ease-in-out group-hover:opacity-100">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className={BUTTON_CLASSES.base}
                onClick={onDuplicate}
              >
                <Copy className="mr-1 size-3" /> Duplicate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={BUTTON_CLASSES.base}
                onClick={onDelete}
              >
                <Trash2 className="mr-1 size-3" /> Delete
              </Button>
            </div>
          </div>
        )}
      </div>
      <div
        className={cn(
          "mb-4 flex items-start justify-between",
          shouldHideControls ? "w-full" : "pr-6"
        )}
      >
        <div className={cn(shouldHideControls ? "w-full" : "pr-6")}>
          <div className="flex">
            <InlineEditableField
              id={`title-${question.id}`}
              label="Question Title"
              defaultValue={question.title}
              onConfirm={(value) => onFieldUpdate("title", value)}
              placeholder="Enter question title"
              hideLabel
              className={`text-lg font-medium ${shouldHideControls ? "w-full" : ""}`}
            />
          </div>
          <div className="flex">
            <InlineEditableField
              id={`desc-${question.id}`}
              label="Description"
              defaultValue={question.description}
              onConfirm={(value) => onFieldUpdate("description", value)}
              placeholder="Add optional description..."
              hideLabel
              className={`text-muted-foreground text-sm ${shouldHideControls ? "w-full" : ""}`}
              useTextArea
            />
          </div>
        </div>
      </div>
    </div>
  )
}
