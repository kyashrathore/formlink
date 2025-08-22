import { getenv } from "@/lib/env"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { z } from "zod"
import { ENHANCED_METADATA_PROMPT } from "../../prompts"
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
  writeData: (data: unknown) => void
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
  getSequence: () => number
): Promise<MetadataGenerationResult> {
  try {
    // Stream progress update
    dataStream.writeData({
      type: "progress",
      message: "Analyzing your input and generating form structure...",
      step: "metadata_generation",
      progress: 10,
    })

    // Prepare the system prompt with user input
    const systemPromptTemplate = ENHANCED_METADATA_PROMPT || ""
    const aiSystemPromptWithInput = systemPromptTemplate.replace(
      "{{userInput}}",
      normalizedInputContent
    )

    // Initialize OpenRouter provider
    const openRouterProvider = createOpenRouter({
      apiKey: getenv("OPENROUTER_API_KEY") || "",
    })

    dataStream.writeData({
      type: "progress",
      message: "Generating form metadata with AI...",
      step: "ai_processing",
      progress: 30,
    })

    // Core AI call - extracted from original lines 102-107
    const result = await generateObject({
      model: openRouterProvider("openai/gpt-4o-mini"),
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
    dataStream.writeData({
      type: "custom_agent_event",
      payload: createAgentEvent(
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
    dataStream.writeData({
      type: "custom_agent_event",
      payload: createAgentEvent(
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
    dataStream.writeData({
      type: "progress",
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

    dataStream.writeData({
      type: "error",
      message: "Failed to generate form metadata",
      error: errorMessage,
      step: "metadata_error",
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}
