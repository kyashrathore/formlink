"use client"

import { cn } from "@/lib/utils"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Question } from "@formlink/schema"
import { Card } from "@formlink/ui"
import { GripVertical } from "lucide-react"
import React from "react"
import QuestionDetail from "./QuestionDetails"

interface SortableQuestionItemProps {
  question: Question
  userId: string
  isPublishedMode: boolean
  selectedTab?: string
}

const SortableQuestionItem: React.FC<SortableQuestionItemProps> = ({
  question,
  userId,
  isPublishedMode,
  selectedTab,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id, disabled: isPublishedMode })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("p-2 transition-colors", isDragging && "p-2 shadow-lg")}
    >
      <div className="flex items-start gap-2 px-2">
        <div className="flex-grow">
          <QuestionDetail
            userId={userId}
            question={question}
            selectedTab={selectedTab}
          />
        </div>
      </div>
    </Card>
  )
}

export default SortableQuestionItem
