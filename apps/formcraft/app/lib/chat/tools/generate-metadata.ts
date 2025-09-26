import { generateObject } from "@/app/lib/ai/tracing"
import { loadPrompt } from "@formlink/prompts"
import { z } from "zod"
import { getModel } from "../../ai/provider"
import { getDefaultSettings } from "../../settings-defaults"
import { createAgentEvent } from "../../types/agent-events"

const QuestionTypeEnumSchema = z.enum([
  "text",
  "singleChoice",
  "multipleChoice",
  "rating",
  "date",
  "ranking",
  "fileUpload",
  "address",
  "linearScale",
  "likertScale",
])

/**
 * Schema for question details returned by the AI
 */
const QuestionDetailSchema = z.object({
  question_specs: z.string().min(1, "Question text cannot be empty."),
  type: QuestionTypeEnumSchema,
})

/**
 * Schema for the complete metadata response from AI
 */
const MetadataResponseSchema = z.object({
  title: z.string().min(1, "Title cannot be empty."),
  description: z.string().min(1, "Description cannot be empty."),
  questionDetails: z
    .array(QuestionDetailSchema)
    .min(1, "At least one question detail is required."),
  journeyScript: z
    .string()
    .min(1, "Journey script cannot be empty.")
    .describe("Complete form journey in markdown format with semantic tags"),
})

/**
 * Interface for the metadata generation result
 */
export interface MetadataGenerationResult {
  success: boolean
  metadata?: {
    title: string
    description: string
    questionDetails: Array<{
      question_specs: string
      type: z.infer<typeof QuestionTypeEnumSchema>
    }>
    journeyScript: string
  }
  error?: string
}

/**
 * Interface for progress streaming
 */
interface DataStream {
  write: (data: { type: string; [key: string]: unknown }) => void
}

/**
 * Generate form metadata using AI SDK instead of Langchain
 * Extracted from metadata_generator.ts:102-107
 *
 * @param normalizedInputContent - The user's input content
 * @param dataStream - Progress streaming interface
 * @param formId - Form ID for progress tracking
 * @param userId - User ID for progress tracking
 * @param getSequence - Function to get next sequence number for events
 * @returns Promise<MetadataGenerationResult>
 */
export async function generateMetadata(
  normalizedInputContent: string,
  dataStream: DataStream,
  formId: string,
  userId: string,
  getSequence: () => number,
  modelId?: string
): Promise<MetadataGenerationResult> {
  try {
    // Stream progress update
    dataStream.write({
      type: "data-progress",
      message: "Analyzing your input and generating form structure...",
      step: "metadata_generation",
      progress: 10,
    })

    // Prepare the system prompt from template with variables
    const aiSystemPromptWithInput = await loadPrompt(
      "form/enhanced-metadata.md",
      { userInput: normalizedInputContent }
    )

    dataStream.write({
      type: "data-progress",
      message: "Generating form metadata with AI...",
      step: "ai_processing",
      progress: 30,
    })

    // Core AI call - using OpenRouter to avoid Vercel restrictions
    const result = await generateObject({
      model: getModel(modelId) as any,
      schema: MetadataResponseSchema,
      system: aiSystemPromptWithInput,
      prompt: normalizedInputContent,
    })

    const aiResponseData = result.object

    // Validate response completeness
    if (
      !aiResponseData ||
      !aiResponseData.title ||
      !aiResponseData.description
    ) {
      throw new Error("Failed to obtain complete form metadata from AI stream.")
    }

    // Send metadata completion event for progressive UI
    dataStream.write({
      type: "data-agent_event",
      data: createAgentEvent(
        "state_snapshot",
        "state",
        {
          form: {
            id: formId,
            version_id: "temp-" + Date.now(),
            title: aiResponseData.title,
            description: aiResponseData.description,
            questions: [],
            settings: getDefaultSettings(),
            current_draft_version_id: null,
            current_published_version_id: null,
            short_id: undefined,
          },
          agentState: {
            formId,
            shortId: "temp",
            userId,
            originalInput: normalizedInputContent,
            inputType: "prompt" as const,
            tasksToPersist: [],
            generatedQuestionSchemas: [],
            agentMessages: [],
            iteration: 1,
            eventSequence: getSequence(),
            formMetadata: {
              title: aiResponseData.title,
              description: aiResponseData.description,
            },
          },
          isComplete: false,
        },
        formId,
        userId,
        getSequence()
      ),
    })

    // Send journey completion event for progressive UI
    dataStream.write({
      type: "data-agent_event",
      data: createAgentEvent(
        "state_snapshot",
        "state",
        {
          form: {
            id: formId,
            version_id: "temp-" + Date.now(),
            title: aiResponseData.title,
            description: aiResponseData.description,
            questions: [],
            settings: {
              ...getDefaultSettings(),
              journeyScript: aiResponseData.journeyScript,
            },
            current_draft_version_id: null,
            current_published_version_id: null,
            short_id: undefined,
          },
          agentState: {
            formId,
            shortId: "temp",
            userId,
            originalInput: normalizedInputContent,
            inputType: "prompt" as const,
            tasksToPersist: [],
            generatedQuestionSchemas: [],
            agentMessages: [],
            iteration: 1,
            eventSequence: getSequence(),
            settings: {
              journeyScript: aiResponseData.journeyScript,
            },
          },
          isComplete: false,
        },
        formId,
        userId,
        getSequence()
      ),
    })

    // Keep original progress message for logging
    dataStream.write({
      type: "data-progress",
      message: `Generated form "${aiResponseData.title}" with ${aiResponseData.questionDetails.length} questions`,
      step: "metadata_complete",
      progress: 100,
    })

    return {
      success: true,
      metadata: {
        title: aiResponseData.title,
        description: aiResponseData.description,
        questionDetails: aiResponseData.questionDetails,
        journeyScript: aiResponseData.journeyScript,
      },
    }
  } catch (error) {
    const errorMessage =
      (error as Error)?.message || "Unknown error during metadata generation."

    // Let the workflow handle the error - don't write raw stream events

    return {
      success: false,
      error: errorMessage,
    }
  }
}
