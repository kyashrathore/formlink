import { cn } from "@/app/lib"
import { useSortable } from "@dnd-kit/sortable"
import { EditableQuestionField, Question } from "@formlink/schema"
import { Button } from "@formlink/ui"
import { Copy, GripVertical, Trash2 } from "lucide-react"
import React from "react"
import InlineEditableField from "../../InlineEditableField"

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
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            {...(!isPublishedMode ? attributes : {})}
            {...(!isPublishedMode ? listeners : {})}
            className={cn(
              "text-muted-foreground hover:text-foreground mt-0.5 -ml-1 flex cursor-grab items-center p-1 active:cursor-grabbing",
              isPublishedMode && "cursor-not-allowed opacity-50"
            )}
            title={
              isPublishedMode
                ? "Reordering disabled for published forms"
                : "Drag to reorder"
            }
          >
            <GripVertical className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-[10px] leading-tight font-medium tracking-wider uppercase">
              {question.type.name}
            </span>
            <span className="text-muted-foreground/60 font-mono text-[10px] leading-tight">
              #{question.id}
            </span>
          </div>
        </div>

        {!shouldHideControls && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-6 w-6"
              onClick={onDuplicate}
              title="Duplicate"
            >
              <Copy className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-6 w-6"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        )}
      </div>

      <div className={cn(shouldHideControls ? "w-full" : "pr-6")}>
        <div className="space-y-1">
          <InlineEditableField
            id={`title-${question.id}`}
            label="Question Title"
            defaultValue={question.title}
            onConfirm={(value) => onFieldUpdate("title", value)}
            placeholder="Enter question title"
            hideLabel
            isCompact
            className={`text-left text-sm leading-normal font-medium ${shouldHideControls ? "w-full" : ""}`}
            noBackground
          />
          <InlineEditableField
            id={`desc-${question.id}`}
            label="Description"
            defaultValue={question.description}
            onConfirm={(value) => onFieldUpdate("description", value)}
            placeholder="Add optional description..."
            hideLabel
            isCompact
            useTextArea
            className={`text-muted-foreground text-left text-xs ${shouldHideControls ? "w-full" : ""}`}
            noBackground
          />
        </div>
      </div>
    </div>
  )
}
