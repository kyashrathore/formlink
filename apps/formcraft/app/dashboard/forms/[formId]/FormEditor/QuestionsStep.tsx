"use client"

import PromptDialog from "@/app/components/PromptDialog"
import { useFormAgentStore } from "@/app/stores/formAgentStore" // Import agent store

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Question } from "@formlink/schema" // Import Question type
import { Button, Skeleton, toast } from "@formlink/ui"
import { Plus } from "lucide-react"
import React, { useMemo, useState } from "react" // Added useMemo
import { useMobile } from "../../../../../hooks/use-mobile"
import SortableQuestionItem from "./SortableQuestionItem"
import { useFormStore } from "./useFormStore"

// Assuming Skeleton component is available

interface QuestionsStepProps {
  userId: string
  selectedTab: string
}

const QuestionsStep: React.FC<QuestionsStepProps> = ({
  userId,
  selectedTab,
}) => {
  const {
    form: persistedForm,
    reorderQuestions,
    addQuestion,
    form: storeForm,
  } = useFormStore()
  const {
    agentState,
    // progress, // No longer needed directly for questionTaskCount
    questionTaskCount: storeQuestionTaskCount, // Get questionTaskCount from the store
  } = useFormAgentStore()

  const isMobile = useMobile()
  const shouldHideControls = isMobile && selectedTab === "content"
  const questionTaskCount = storeQuestionTaskCount ?? 0 // Use value from store

  const isAgentActive =
    agentState?.status === "PROCESSING" || agentState?.status === "INITIALIZING"

  type SkeletonPlaceholder = {
    id: string
    order: number
    isSkeleton: true
    // Add minimal fields to satisfy SortableQuestionItem if it expects parts of Question,
    // or ensure SortableQuestionItem handles this type. For now, assume it's distinct.
    // For keying and basic structure, id and order are primary.
  }

  type ActualQuestionItem = Question & {
    order: number // Ensure actual questions also have an order property for sorting and mapping
    isSkeleton?: false // Optional, to clearly distinguish from SkeletonPlaceholder
  }

  type RenderableItem = ActualQuestionItem | SkeletonPlaceholder

  const questionsToRender = useMemo((): RenderableItem[] => {
    const persistedQuestions: Question[] = persistedForm?.questions || []
    const items: RenderableItem[] = []

    // Create a map of persisted questions by their order for quick lookup
    const persistedQuestionMap = new Map<number, ActualQuestionItem>()
    persistedQuestions.forEach((q, index) => {
      // Ensure 'order' is a number; use index as a fallback if not present or invalid
      const order =
        typeof (q as any).order === "number" ? (q as any).order : index
      persistedQuestionMap.set(order, { ...q, order, isSkeleton: false })
    })

    const expectedSlots = Math.max(questionTaskCount, persistedQuestions.length)

    for (let i = 0; i < expectedSlots; i++) {
      const order = i
      const existingQuestion = persistedQuestionMap.get(order)

      if (existingQuestion) {
        items.push(existingQuestion)
        persistedQuestionMap.delete(order) // Remove from map as it's been slotted
      } else if (i < questionTaskCount) {
        // Only add skeleton if it's within the agent's expected task count
        // and no persisted question already filled this slot.
        items.push({
          id: `skeleton-${order}`,
          order: order,
          isSkeleton: true,
        })
      }
    }

    // Add any remaining persisted questions that didn't fit into the primary slots
    // (e.g. if their order was > questionTaskCount but still valid, or if questionTaskCount was 0)
    persistedQuestionMap.forEach((unslottedQuestion) => {
      items.push(unslottedQuestion)
    })

    // Sort all items by order
    items.sort((a, b) => a.order - b.order)

    // Deduplication: if a real question and a skeleton share an ID (e.g. skeleton-0 and a real q with id 'skeleton-0'), prefer real.
    // This scenario is less likely with the current ID generation for skeletons.
    // A more common scenario is a skeleton for order X, and a real question for order X. The sort handles order.
    // The primary concern is ensuring each `order` slot is correctly filled.

    return items
  }, [questionTaskCount, persistedForm?.questions])

  const isPublishedMode =
    !!persistedForm?.current_published_version_id &&
    !persistedForm?.current_draft_version_id

  // const questions = form?.questions || [] // Replaced by questionsToRender
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false)
  // const { reorderQuestions, addQuestion, form: storeForm } = useFormStore() // Moved up

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    // Drag and drop might be complex with mixed data sources or primarily for persisted questions.
    // For now, let's assume reordering applies to persistedForm.questions.
    // If agent is active, drag-and-drop might be disabled or need careful handling.
    // Retaining isAgentActive check here for drag and drop, as it might be a specific UI consideration
    // independent of question rendering.
    if (!persistedForm || !persistedForm.questions) {
      // If persistedForm or its questions are not available, cannot reorder.
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

  const questionIds = React.useMemo(
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

      const result = (await response.json()) as any

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
    } catch (error: any) {
      console.error("Error calling AI API for question creation:", error)
      toast({
        title: "Request Failed",
        description:
          error.message ||
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
                // qItem is an ActualQuestionItem
                return (
                  <SortableQuestionItem
                    key={qItem.id}
                    question={qItem as ActualQuestionItem} // It's already an ActualQuestionItem here
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
