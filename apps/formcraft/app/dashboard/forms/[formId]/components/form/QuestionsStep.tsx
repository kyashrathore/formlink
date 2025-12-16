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
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@formlink/ui/ai-elements"
import { useMemo } from "react"
import { useMobile } from "../../hooks/use-mobile"
import { useFormEditorStore } from "../../stores/useFormEditorStore"
import { useFormGenerationStore } from "../../stores/useFormGenerationStore"
import { useWorkbench } from "../workbench/WorkbenchContext"
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

  const { agentState, setInitialPrompt } = useFormGenerationStore()
  const { setActiveTool } = useWorkbench()

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

  const handlePromptSubmit = (message: any) => {
    let promptText = ""
    if (typeof message === "string") {
      promptText = message
    } else if (
      message &&
      typeof message === "object" &&
      Array.isArray(message.parts)
    ) {
      promptText = message.parts
        .map((p: any) => (p.type === "text" ? p.text : ""))
        .join("")
    }

    if (!promptText.trim()) return
    setInitialPrompt(promptText)
    setActiveTool("chat")
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
          </div>
          <div className="flex flex-col gap-4 pb-20">
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

            {/* Sticky Prompt Input */}
            {!isPublishedMode && !shouldHideControls && (
              <div className="sticky bottom-4 z-10 mx-auto w-full max-w-2xl">
                <div className="bg-background/80 supports-[backdrop-filter]:bg-background/60 hover:ring-primary/20 rounded-xl border p-1 shadow-lg backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:ring-1">
                  <PromptInput
                    onSubmit={handlePromptSubmit}
                    className="border-0 shadow-none focus-visible:ring-0"
                  >
                    <PromptInputTextarea
                      placeholder="Describe a question to add..."
                      className="min-h-[2.5rem]"
                    />
                    <PromptInputFooter className="px-3 py-2">
                      <span />
                      <PromptInputTools>
                        <PromptInputSubmit />
                      </PromptInputTools>
                    </PromptInputFooter>
                  </PromptInput>
                </div>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default QuestionsStep
