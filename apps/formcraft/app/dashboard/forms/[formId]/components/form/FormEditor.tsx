"use client"

import {
  AsyncCollectionSection,
  AsyncSection,
} from "@/app/components/AsyncSection"
import { useFormEditorStore } from "@/app/dashboard/forms/[formId]/stores/useFormEditorStore"
import { useFormGenerationStore } from "@/app/dashboard/forms/[formId]/stores/useFormGenerationStore"
import { AsyncCollection } from "@/app/lib/types/async-data"
import { User } from "@formlink/db"
import { Form, Question } from "@formlink/schema"
import { Loader2 } from "lucide-react"
import React from "react"
import { useWarnIfUnsavedChanges } from "../../hooks/useWarnIfUnsavedChanges"
import FormDetailsStep from "./FormDetailsStep"
import FormJourneyStep from "./FormJourneyStep"
import QuestionsStep from "./QuestionsStep"
import {
  JourneyShimmer,
  MetadataShimmer,
  QuestionsShimmer,
} from "./shimmers/FormShimmers"

type FormEditorProps = {
  user: User | null
  selectedTab: string
}

const FormEditor: React.FC<FormEditorProps> = ({ user, selectedTab }) => {
  // Warn on browser refresh/close if form has unsaved changes
  useWarnIfUnsavedChanges()
  const { updateFormField, form } = useFormEditorStore()

  // Selectors for AI generation state
  const {
    formMetadata,
    currentForm,
    generatedQuestions,
    isFormGenerating,
    hasFormMetadata,
    hasFormJourney,
    showQuestionsSection,
    questionProgress,
    initialPrompt,
  } = useFormGenerationStore()

  // Handle form field updates
  const handleUpdateFormDetails = React.useCallback(
    <K extends keyof Pick<Form, "title" | "description">>(
      field: K,
      value: Form[K]
    ) => {
      if (form && form[field] !== value) {
        const valueToSave =
          typeof value === "string" &&
          value.trim() === "" &&
          field === "description"
            ? undefined
            : value
        updateFormField(field, valueToSave || "")
      }
    },
    [form, updateFormField]
  )

  // When not generating, create data structures for Async sections from the loaded form.
  // This ensures we display the existing form data, not the idle generation state.
  const metadataData =
    isFormGenerating || (initialPrompt && !form?.title)
      ? {
          status: hasFormMetadata ? ("success" as const) : ("loading" as const),
          data: hasFormMetadata ? formMetadata : null, // Don't provide data when loading to show shimmer
          error: null,
          lastUpdated: hasFormMetadata ? new Date() : null,
        }
      : {
          status: "success" as const,
          data: {
            title: form?.title || "",
            description: form?.description || "",
          },
          error: null,
          lastUpdated: new Date(),
        }

  const journeyData =
    isFormGenerating || (initialPrompt && !form?.settings?.journeyScript)
      ? {
          status: hasFormJourney ? ("success" as const) : ("loading" as const),
          data: hasFormJourney
            ? currentForm?.settings?.journeyScript || ""
            : null, // Don't provide data when loading to show shimmer
          error: null,
          lastUpdated: hasFormJourney ? new Date() : null,
        }
      : {
          status: "success" as const,
          data: form?.settings?.journeyScript || "",
          error: null,
          lastUpdated: new Date(),
        }

  // Create properly typed AsyncCollection for questions
  const questionsData: AsyncCollection<Question> =
    isFormGenerating || (initialPrompt && (form?.questions?.length ?? 0) === 0)
      ? {
          status: questionProgress?.total > 0 ? "loading" : "loading",
          items: generatedQuestions || [],
          total: questionProgress?.total || 0,
          generatedCount:
            generatedQuestions?.filter((q) => q !== null).length || 0,
          progressStatus: questionProgress?.total > 0 ? "success" : "loading",
          error: null,
        }
      : {
          status: "success" as const,
          items: form?.questions || [],
          total: form?.questions?.length || 0,
          generatedCount: form?.questions?.length || 0,
          progressStatus: "success" as const,
          error: null,
        }

  // Determine section visibility based on generation status or existing form data.
  // If there's an initial prompt, show all sections to start loading immediately
  const showMetadata = isFormGenerating || !!form?.title || !!initialPrompt
  const showJourney =
    isFormGenerating || !!form?.settings?.journeyScript || !!initialPrompt
  const showQuestions =
    isFormGenerating ||
    (form?.questions?.length ?? 0) > 0 ||
    showQuestionsSection ||
    !!initialPrompt

  return (
    <div className="flex flex-col items-center space-y-8">
      {/* Metadata Section */}
      {showMetadata && (
        <AsyncSection
          data={metadataData}
          shimmer={MetadataShimmer}
          content={({ data }) => (
            <FormDetailsStep
              title={data?.title || ""}
              description={data?.description || ""}
              onUpdate={handleUpdateFormDetails}
            />
          )}
          onRetry={undefined} // No retry action available for display-only sections
          ariaLabel="Form Details"
          className="w-full"
        />
      )}

      {/* Journey Section */}
      {showJourney && (
        <AsyncSection
          data={journeyData}
          shimmer={JourneyShimmer}
          content={({ data }) => (
            <FormJourneyStep
              journeyScript={data || ""}
              userId={user?.id}
              selectedTab={selectedTab}
            />
          )}
          onRetry={undefined} // No retry action available for display-only sections
          ariaLabel="Form Journey"
          className="w-full"
        />
      )}

      {/* Questions Section */}
      {showQuestions && (
        <AsyncCollectionSection
          data={questionsData as any}
          shimmer={() =>
            (questionsData.total ?? 0) > 0 ? (
              <QuestionsShimmer count={questionsData.total ?? 0} />
            ) : (
              <QuestionsLoadingIndicator />
            )
          }
          content={({ data }) => (
            <QuestionsStep
              questions={data.items as Question[]}
              totalCount={data.total}
              generatedCount={data.generatedCount || 0}
              userId={user?.id || undefined}
              selectedTab={selectedTab}
            />
          )}
          onRetry={undefined} // No retry action available for display-only sections
          ariaLabel="Questions"
          className="w-full"
        />
      )}
    </div>
  )
}

/**
 * Loading indicator for questions when we don't know the count yet
 */
const QuestionsLoadingIndicator: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="mr-2 animate-spin" />
    <span className="text-muted-foreground">Preparing questions...</span>
  </div>
)

export default FormEditor
