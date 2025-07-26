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
import { Button, Skeleton, toast } from "@formlink/ui"
import { Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useMobile } from "../../hooks/use-mobile"
import { useFormAgentStore } from "../../stores/formAgentStore"
import { useFormStore } from "../../stores/useFormStore"
import PromptDialog from "../PromptDialog"
import SortableQuestionItem from "./FormEditor/SortableQuestionItem"

interface QuestionsStepProps {
  userId: string
  selectedTab: string
}

const QuestionsStep = ({ userId, selectedTab }: QuestionsStepProps) => {
  const {
    form: persistedForm,
    reorderQuestions,
    addQuestion,
    form: storeForm,
  } = useFormStore()
  const {
    agentState,

    questionTaskCount: storeQuestionTaskCount,
  } = useFormAgentStore()

  const isMobile = useMobile()
  const shouldHideControls = isMobile && selectedTab === "content"
  const questionTaskCount = storeQuestionTaskCount ?? 0

  const isAgentActive =
    agentState?.status === "PROCESSING" || agentState?.status === "INITIALIZING"

  type SkeletonPlaceholder = {
    id: string
    order: number
    isSkeleton: true
  }

  type ActualQuestionItem = Question & {
    order: number
    isSkeleton?: false
  }

  type RenderableItem = ActualQuestionItem | SkeletonPlaceholder

  const questionsToRender = useMemo((): RenderableItem[] => {
    const persistedQuestions: Question[] = persistedForm?.questions || []
    const items: RenderableItem[] = []

    const persistedQuestionMap = new Map<number, ActualQuestionItem>()
    persistedQuestions.forEach((q, index) => {
      const order =
        typeof (q as unknown as { order?: number }).order === "number"
          ? (q as unknown as { order: number }).order
          : index
      persistedQuestionMap.set(order, { ...q, order, isSkeleton: false })
    })

    const expectedSlots = Math.max(questionTaskCount, persistedQuestions.length)

    for (let i = 0; i < expectedSlots; i++) {
      const order = i
      const existingQuestion = persistedQuestionMap.get(order)

      if (existingQuestion) {
        items.push(existingQuestion)
        persistedQuestionMap.delete(order)
      } else if (i < questionTaskCount) {
        items.push({
          id: `skeleton-${order}`,
          order: order,
          isSkeleton: true,
        })
      }
    }

    persistedQuestionMap.forEach((unslottedQuestion) => {
      items.push(unslottedQuestion)
    })

    items.sort((a, b) => a.order - b.order)

    return items
  }, [questionTaskCount, persistedForm?.questions])

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
    () => questionsToRender.map((q: RenderableItem) => q.id),
    [questionsToRender]
  )

  const handleAddQuestionSubmit = async (prompt: string) => {
    const currentForm = persistedForm || storeForm
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
        toast({
          title: "API Error",
          description:
            result.message ||
            "An unexpected error occurred while creating the question.",
          status: "warning",
        })
      } else if (result.error) {
        toast({
          title: "Creation Error",
          description:
            result.message || "Could not create question from prompt.",
          status: "warning",
        })
      } else if (result.data) {
        addQuestion({
          questionToClone: result.data,
          isNewQuestion: true,
        })
        setIsPromptDialogOpen(false)
      } else {
        toast({
          title: "Creation Error",
          description:
            "Question creation successful, but no question object returned.",
          status: "warning",
        })
      }
    } catch (error) {
      toast({
        title: "Request Failed",
        description:
          (error instanceof Error ? error.message : String(error)) ||
          "Could not connect to AI service for question creation.",
        status: "warning",
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
            {!isPublishedMode && !shouldHideControls && (
              <div>
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
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {questionsToRender.length > 0 ? (
              questionsToRender.map((qItem: RenderableItem) => {
                if ((qItem as SkeletonPlaceholder).isSkeleton) {
                  return (
                    <div
                      key={qItem.id}
                      className="bg-muted/30 rounded-lg border p-4"
                    >
                      <Skeleton className="mb-3 h-8 w-3/4" />
                      <Skeleton className="h-6 w-1/2" />
                    </div>
                  )
                }

                return (
                  <SortableQuestionItem
                    key={qItem.id}
                    question={qItem as ActualQuestionItem}
                    userId={userId}
                    isPublishedMode={isPublishedMode}
                    selectedTab={selectedTab}
                  />
                )
              })
            ) : (
              <p className="text-muted-foreground p-4 text-center text-sm">
                {questionTaskCount > 0 && isAgentActive
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
