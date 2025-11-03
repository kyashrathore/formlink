"use client"

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import type { Question } from "@formlink/schema"
import { Button } from "@formlink/ui"
import { Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useMobile } from "../../hooks/use-mobile"
import { useFormEditorStore } from "../../stores/useFormEditorStore"
import { useFormGenerationStore } from "../../stores/useFormGenerationStore"
import PromptDialog from "../PromptDialog"
import SortableQuestionItem from "./FormEditor/SortableQuestionItem"
import { QuestionSkeleton } from "./shimmers/FormShimmers"

interface QuestionsStepProps {
  questions: Question[]
  totalCount: number | null
  generatedCount: number
  userId?: string
  selectedTab: string
}

const QuestionsStep: React.FC<QuestionsStepProps> = ({
  questions,
  totalCount,
  userId,
  selectedTab,
}) => {
  const {
    form: persistedForm,
    reorderQuestions,
    addQuestion,
  } = useFormEditorStore()

  const { agentState } = useFormGenerationStore()

  const isMobile = useMobile()
  const shouldHideControls = isMobile && selectedTab === "content"

  const isAgentActive =
    agentState?.status === "PROCESSING" || agentState?.status === "INITIALIZING"

  const displayQuestions = useMemo(() => {
    const newDisplayQuestions: (Question | null)[] = [...(questions || [])]
    while (totalCount && newDisplayQuestions.length < totalCount) {
      newDisplayQuestions.push(null)
    }
    return newDisplayQuestions
  }, [questions, totalCount])

  const isPublishedMode =
    !!persistedForm?.current_published_version_id &&
    !persistedForm?.current_draft_version_id

  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!persistedForm || !persistedForm.questions) {
      return
    }

    if (over && active.id !== over.id && !isAgentActive) {
      const oldIndex = persistedForm.questions.findIndex(
        (q) => q.id === active.id
      )
      const newIndex = persistedForm.questions.findIndex(
        (q) => q.id === over.id
      )

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderQuestions(oldIndex, newIndex)
      }
    }
  }

  const questionIds = useMemo(
    () => displayQuestions.map((q) => q?.id).filter(Boolean) as string[],
    [displayQuestions]
  )

  const handleAddQuestionSubmit = async (prompt: string) => {
    const currentForm = persistedForm
    if (!currentForm) return

    const isAuthenticated = true

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationType: "add-question",
          prompt: prompt,
          userId: userId,
          isAuthenticated: isAuthenticated,
          questions: currentForm.questions,
        }),
      })

      const result = (await response.json()) as {
        error?: boolean
        message?: string
        data?: Question
      }

      if (!response.ok) {
        toast.warning("API Error", {
          description:
            result.message ||
            "An unexpected error occurred while creating the question.",
        })
      } else if (result.error) {
        toast.warning("Creation Error", {
          description:
            result.message || "Could not create question from prompt.",
        })
      } else if (result.data) {
        addQuestion({
          questionToClone: result.data,
          isNewQuestion: true,
        })
        setIsPromptDialogOpen(false)
      } else {
        toast.warning("Creation Error", {
          description:
            "Question creation successful, but no question object returned.",
        })
      }
    } catch (error) {
      toast.warning("Request Failed", {
        description:
          (error instanceof Error ? error.message : String(error)) ||
          "Could not connect to AI service for question creation.",
      })
    }
  }

  return (
    <div
      id="questions-step"
      data-spy-section="questions-step"
      className="mb-8 flex w-full flex-col"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={questionIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="mt-8 mb-4 flex items-center justify-between">
            <div className="text-lg font-semibold">Questions</div>
            <div className="flex items-center space-x-4">
              {!isPublishedMode && !shouldHideControls && (
                <PromptDialog
                  trigger={
                    <Button
                      variant="secondary"
                      onClick={() => setIsPromptDialogOpen(true)}
                    >
                      <Plus className="mr-2 size-4" />
                      Add Question
                    </Button>
                  }
                  title="Add New Question"
                  description="Enter a prompt to generate a new question."
                  onSubmit={handleAddQuestionSubmit}
                  isOpen={isPromptDialogOpen}
                  onOpenChange={setIsPromptDialogOpen}
                />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {/* Render generated/existing questions */}
            {displayQuestions.map((question, index) => {
              if (!question) {
                return <QuestionSkeleton key={`skeleton-${index}`} />
              }

              return (
                <div
                  key={question.id}
                  className="animate-in slide-in-from-top-2 duration-300"
                  style={{
                    animationDelay: `${index * 150}ms`,
                  }}
                >
                  <SortableQuestionItem
                    question={question}
                    userId={userId || ""}
                    isPublishedMode={isPublishedMode}
                    selectedTab={selectedTab}
                  />
                </div>
              )
            })}

            {/* Show empty state */}
            {displayQuestions.length === 0 && (
              <p className="text-muted-foreground p-4 text-center text-sm">
                {isAgentActive
                  ? "Agent is generating questions..."
                  : "No questions yet."}
              </p>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default QuestionsStep
