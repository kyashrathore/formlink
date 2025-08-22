/**
 * Main Form Creation Workflow
 *
 * This module provides a sequential workflow for form generation that replaces
 * the previous complex state-graph approach with a simpler, more maintainable
 * function-based architecture using AI SDK streaming.
 */

import logger from "@/app/lib/logger"
import { Form } from "@formlink/schema"
import { QUESTION_SCHEMA_PROMPT } from "../../prompts"
import { getDefaultSettings } from "../../settings-defaults"
import { AgentEvent, createAgentEvent } from "../../types/agent-events"
import {
  finalizeForm,
  generateMetadata,
  generateQuestionsParallel,
  type FormContent,
  type GenerateQuestionParams,
} from "./core-functions"

/**
 * Interface for progress streaming
 */
interface DataStream {
  writeData: (data: unknown) => void
}

/**
 * Interface for workflow parameters
 */
export interface WorkflowParams {
  prompt: string
  shortId: string
  formId: string
  selectedModel?: string
}

/**
 * Interface for workflow result
 */
export interface WorkflowResult {
  success: boolean
  form?: Form
  error?: string
  events: AgentEvent[]
}

/**
 * Build form object for events from finalized content
 */
function buildFormForEvent(
  formId: string,
  shortId: string,
  formContent: FormContent,
  versionId?: string
): Form {
  // Apply repair to questions before sending to frontend
  const repairedQuestions = formContent.questions

  return {
    id: formId,
    version_id: versionId || "temp-" + Date.now(),
    title: formContent.title,
    description: formContent.description,
    questions: repairedQuestions as any,
    settings: (formContent.settings as any) || getDefaultSettings(),
    current_draft_version_id: versionId,
    current_published_version_id: undefined,
    short_id: shortId,
  }
}

/**
 * Creates a form through a sequential workflow process
 *
 * Orchestrates form generation by processing metadata, generating questions
 * in parallel, and finalizing the form to the database with real-time progress streaming.
 *
 * @param params - Workflow parameters
 * @param userId - User ID
 * @param dataStream - Progress streaming interface
 * @returns Promise<WorkflowResult>
 */
export async function createFormWorkflow(
  params: WorkflowParams,
  userId: string,
  dataStream: DataStream
): Promise<WorkflowResult> {
  const { prompt, shortId, formId, selectedModel } = params
  const events: AgentEvent[] = []
  let eventSequence = 0

  try {
    // Check for required environment variables early
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY environment variable is not set. Please check your .env.local file."
      )
    }

    logger.info(
      `[CREATE_FORM_WORKFLOW] Starting simplified workflow for formId: ${formId}, prompt: "${prompt}"`
    )

    // Step 1: Initialize
    const initEvent = createAgentEvent(
      "agent_initialized",
      "system",
      {
        message: "Simplified workflow process initialized.",
        details: { inputType: "prompt", prompt },
      },
      formId,
      userId,
      eventSequence++
    )
    events.push(initEvent)

    // Stream the initialization event
    dataStream.writeData({
      type: "custom_agent_event",
      payload: initEvent,
    })

    logger.info(
      `[CREATE_FORM_WORKFLOW] Agent initialized event sent for formId: ${formId}`
    )

    // Step 2: Generate Metadata
    logger.info(
      `[CREATE_FORM_WORKFLOW] Step 1: Generating metadata for formId: ${formId}`
    )

    const metadataResult = await generateMetadata(
      prompt,
      dataStream,
      formId,
      userId,
      () => ++eventSequence
    )

    if (!metadataResult.success || !metadataResult.metadata) {
      throw new Error(metadataResult.error || "Failed to generate metadata")
    }

    const { title, description, questionDetails, journeyScript } =
      metadataResult.metadata

    logger.info(
      `[CREATE_FORM_WORKFLOW] Metadata generated: title="${title}", questions=${questionDetails.length}`
    )

    // Step 3: Generate Questions in Parallel
    logger.info(
      `[CREATE_FORM_WORKFLOW] Step 2: Generating ${questionDetails.length} questions in parallel for formId: ${formId}`
    )

    // Prepare question generation parameters
    const questionParams: GenerateQuestionParams[] = questionDetails.map(
      (detail, index) => ({
        questionTitle: detail.question_specs,
        questionType: detail.type,
        order: index,
        totalQuestions: questionDetails.length,
        formContext: {
          title,
          description,
        },
      })
    )

    // Generate all questions in parallel using Promise.all()
    let currentSequence = eventSequence // Use existing sequence counter
    const questionResults = await generateQuestionsParallel(
      questionParams,
      dataStream,
      QUESTION_SCHEMA_PROMPT,
      formId,
      userId,
      () => ++currentSequence
    )
    // Update eventSequence after question generation
    eventSequence = currentSequence

    // Check for question generation failures
    const failedQuestions = questionResults.filter((r) => !r.success)
    if (failedQuestions.length > 0) {
      logger.warn(
        `[CREATE_FORM_WORKFLOW] ${failedQuestions.length} questions failed to generate`
      )
    }

    const successfulQuestions = questionResults
      .filter((r) => r.success && r.question)
      .map((r) => r.question!)

    if (successfulQuestions.length === 0) {
      throw new Error("No questions were successfully generated")
    }

    logger.info(
      `[CREATE_FORM_WORKFLOW] Generated ${successfulQuestions.length} questions successfully`
    )

    // Step 4: Prepare form content for finalization
    const formContent: FormContent = {
      title,
      description,
      questions: successfulQuestions,
      settings: journeyScript ? { journeyScript } : {},
      journeyScript,
    }

    // Step 4: Finalize Form
    logger.info(
      `[CREATE_FORM_WORKFLOW] Step 3: Finalizing form for formId: ${formId}`
    )

    const finalizationResult = await finalizeForm({
      formId,
      userId,
      formContent,
      dataStream,
    })

    if (!finalizationResult.success) {
      throw new Error(finalizationResult.error || "Form finalization failed")
    }

    logger.info(
      `[CREATE_FORM_WORKFLOW] Form finalized successfully with versionId: ${finalizationResult.newVersionId}`
    )

    // Step 5: Create final state snapshot
    const finalForm = buildFormForEvent(
      formId,
      shortId,
      formContent,
      finalizationResult.newVersionId
    )

    const finalStateEvent = createAgentEvent(
      "state_snapshot",
      "state",
      {
        form: finalForm,
        agentState: {
          formId,
          shortId,
          userId,
          originalInput: prompt,
          inputType: "prompt" as const,
          selectedModel,
          tasksToPersist: [],
          generatedQuestionSchemas: successfulQuestions as any,
          agentMessages: [],
          iteration: 1,
          eventSequence,
          _agentEvents: events,
          resultPageGenerationPrompt: "",
          status: "COMPLETED" as const,
          formMetadata: { title, description },
          settings: formContent.settings,
        },
        isComplete: true,
      },
      formId,
      userId,
      eventSequence++
    )
    events.push(finalStateEvent)

    dataStream.writeData({
      type: "custom_agent_event",
      payload: finalStateEvent,
    })

    // Step 6: Finalize
    const finalizeEvent = createAgentEvent(
      "agent_finalized",
      "system",
      {
        message: "Simplified workflow completed successfully.",
        details: {
          questionCount: successfulQuestions.length,
          versionId: finalizationResult.newVersionId,
        },
      },
      formId,
      userId,
      eventSequence++
    )
    events.push(finalizeEvent)

    dataStream.writeData({
      type: "custom_agent_event",
      payload: finalizeEvent,
    })

    logger.info(
      `[CREATE_FORM_WORKFLOW] Simplified workflow completed successfully for formId: ${formId}`
    )

    return {
      success: true,
      form: finalForm,
      events,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(
      `[CREATE_FORM_WORKFLOW] Workflow failed for formId: ${formId}:`,
      { error }
    )

    // Create error event
    const errorEvent = createAgentEvent(
      "agent_error",
      "error",
      {
        message: `Simplified workflow execution error: ${errorMessage}`,
        details: error,
        recoverable: false,
      },
      formId,
      userId,
      eventSequence++
    )
    events.push(errorEvent)

    dataStream.writeData({
      type: "custom_agent_event",
      payload: errorEvent,
    })

    return {
      success: false,
      error: errorMessage,
      events,
    }
  }
}
