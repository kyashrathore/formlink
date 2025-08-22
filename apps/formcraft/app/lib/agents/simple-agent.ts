import { createServerClient, type Json } from "@formlink/db"
import {
  Form,
  FormSchema as FullFormSchema,
  Question,
  QuestionSchema,
} from "@formlink/schema"
import { customAlphabet } from "nanoid"
import { z } from "zod"
import { createFormWorkflow } from "../chat/tools/create-form-workflow"
import logger from "../logger"
import { getDefaultSettings } from "../settings-defaults"
import {
  AgentEvent,
  AgentState,
  createAgentEvent,
  StateSnapshotEvent,
} from "../types/agent-events"
import { UpdateFormSchema } from "../types/chat"

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  10
)

/**
 * Interface for progress streaming - needed for compatibility with workflow
 */
interface DataStream {
  writeData: (data: unknown) => void
}

/**
 * Simplified form creation agent using workflow-based approach
 *
 * This function creates forms by orchestrating the workflow system while maintaining
 * the async generator interface for backward compatibility with existing callers.
 *
 * @param params - Form creation parameters
 * @param userId - User ID
 * @returns AsyncGenerator<AgentEvent> - Streams form creation events
 */
export async function* createFormAgent(
  params: {
    prompt: string
    shortId: string
    formId: string
    selectedModel?: string
  },
  userId: string
): AsyncGenerator<AgentEvent> {
  logger.info(
    `[SIMPLE_AGENT] Starting simplified form creation for formId: ${params.formId}, prompt: "${params.prompt}"`
  )

  // Create data stream that yields events as they arrive
  const eventQueue: AgentEvent[] = []
  let isWorkflowComplete = false
  let workflowError: string | undefined

  const dataStream: DataStream = {
    writeData: (data: unknown) => {
      // Only process custom_agent_event data that contains AgentEvent payloads
      if (
        data &&
        typeof data === "object" &&
        "type" in data &&
        data.type === "custom_agent_event" &&
        "payload" in data
      ) {
        const payload = data.payload as AgentEvent
        eventQueue.push(payload)
      }
      // Ignore other progress events since they're handled by the workflow internally
    },
  }

  // Start the workflow
  const workflowPromise = createFormWorkflow(
    {
      prompt: params.prompt,
      shortId: params.shortId,
      formId: params.formId,
      selectedModel: params.selectedModel,
    },
    userId,
    dataStream
  )
    .then((result) => {
      isWorkflowComplete = true
      if (!result.success) {
        workflowError = result.error
      }
    })
    .catch((error) => {
      isWorkflowComplete = true
      workflowError = error instanceof Error ? error.message : String(error)
    })

  // Yield events as they arrive in the queue
  while (!isWorkflowComplete || eventQueue.length > 0) {
    if (eventQueue.length > 0) {
      const event = eventQueue.shift()!
      logger.info(
        `[SIMPLE_AGENT] Yielding event: ${event.type} - ${event.category} (seq: ${event.sequence}) for formId: ${params.formId}`
      )
      yield event
    } else {
      // Wait more efficiently for more events (reduced polling frequency)
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  // Check for workflow errors
  if (workflowError) {
    logger.error(
      `[SIMPLE_AGENT] Workflow failed for formId: ${params.formId}: ${workflowError}`
    )
    // Error events should already be in the queue, but ensure we handle any missed errors
  }

  // Await the workflow to ensure it completes
  await workflowPromise

  logger.info(
    `[SIMPLE_AGENT] Simplified workflow completed for formId: ${params.formId}`
  )
}

export async function* updateFormAgent(
  params: {
    formId: string
    updates: z.infer<typeof UpdateFormSchema>["updates"]
    selectedModel?: string
  },
  userId: string
): AsyncGenerator<AgentEvent> {
  let currentSequence = 0
  const { formId, updates } = params

  const agentState: AgentState = {
    formId,
    shortId: formId.substring(0, 8),
    userId,
    originalInput: updates,
    inputType: "prompt",
    selectedModel: params.selectedModel,
    tasksToPersist: [],
    generatedQuestionSchemas: [],
    agentMessages: [],
    iteration: 0,
    eventSequence: currentSequence,
    _agentEvents: [],
    resultPageGenerationPrompt: "",
    status: "INITIALIZING",
    formMetadata: undefined,
    settings: undefined,
  }

  yield createAgentEvent(
    "agent_initialized",
    "system",
    { message: "Update agent initialized." },
    formId,
    userId,
    currentSequence++
  )
  agentState.eventSequence = currentSequence
  agentState.status = "PROCESSING"

  const buildFormForEvent = (
    dbVersionData: Partial<z.infer<typeof FullFormSchema>> | null,
    tempVersionId?: string
  ): Form => {
    const baseTitle = dbVersionData?.title
      ? String(dbVersionData.title)
      : "Untitled Form"
    const baseDescription = dbVersionData?.description
      ? String(dbVersionData.description)
      : undefined

    // Apply repair to questions before sending to frontend
    const rawQuestions = dbVersionData?.questions || []
    const repairedQuestions = rawQuestions

    return {
      id: formId,
      version_id: tempVersionId || dbVersionData?.version_id || nanoid(),
      title: baseTitle,
      description: baseDescription,
      questions: repairedQuestions,
      settings: dbVersionData?.settings || getDefaultSettings(),

      current_draft_version_id:
        dbVersionData?.current_draft_version_id || undefined,
      current_published_version_id:
        dbVersionData?.current_published_version_id || undefined,
      short_id: dbVersionData?.short_id || undefined,
    }
  }

  try {
    const supabase = await createServerClient(undefined, "service")
    logger.info(
      `[updateFormAgent] Supabase client created for formId: ${formId}`
    )

    const initialFormSnapshot = buildFormForEvent(null)
    agentState.formMetadata = {
      title: initialFormSnapshot.title,
      description: initialFormSnapshot.description || "",
    }
    agentState.settings = initialFormSnapshot.settings

    yield createAgentEvent(
      "state_snapshot",
      "state",
      {
        form: initialFormSnapshot,
        agentState: { ...agentState },
        isComplete: false,
      },
      formId,
      userId,
      currentSequence++
    ) as StateSnapshotEvent
    agentState.eventSequence = currentSequence

    const { data: currentFormDbRecord, error: formError } = await supabase
      .from("forms")
      .select("current_draft_version_id, short_id")
      .eq("id", formId)
      .single()

    if (
      formError ||
      !currentFormDbRecord ||
      !currentFormDbRecord.current_draft_version_id
    ) {
      throw new Error(
        `Failed to fetch form or current_draft_version_id for formId ${formId}: ${formError?.message}`
      )
    }
    logger.info(
      `[updateFormAgent] Fetched current_draft_version_id: ${currentFormDbRecord.current_draft_version_id} for formId: ${formId}`
    )

    const { data: currentVersionDataFromDb, error: versionError } =
      await supabase
        .from("form_versions")
        .select("*")
        .eq("version_id", currentFormDbRecord.current_draft_version_id)
        .single()

    if (versionError || !currentVersionDataFromDb) {
      throw new Error(
        `Failed to fetch form version data for version_id ${currentFormDbRecord.current_draft_version_id}: ${versionError?.message}`
      )
    }
    logger.info(
      `[updateFormAgent] Fetched form version data for formId: ${formId}`
    )

    const currentFullFormSchemaCompliant: z.infer<typeof FullFormSchema> = {
      id: formId,
      version_id: currentVersionDataFromDb.version_id,
      title: String(currentVersionDataFromDb.title),
      description: currentVersionDataFromDb.description
        ? String(currentVersionDataFromDb.description)
        : undefined,
      questions: (currentVersionDataFromDb.questions
        ? Array.isArray(currentVersionDataFromDb.questions)
          ? currentVersionDataFromDb.questions
          : []
        : []) as Question[],
      settings: (currentVersionDataFromDb.settings &&
      typeof currentVersionDataFromDb.settings === "object" &&
      !Array.isArray(currentVersionDataFromDb.settings)
        ? currentVersionDataFromDb.settings
        : {}) as z.infer<typeof FullFormSchema>["settings"],
      current_draft_version_id: currentFormDbRecord.current_draft_version_id,

      short_id: currentFormDbRecord.short_id || undefined,
    }

    agentState.formMetadata = {
      title: currentFullFormSchemaCompliant.title,
      description: currentFullFormSchemaCompliant.description || "",
    }
    agentState.settings = currentFullFormSchemaCompliant.settings

    const updatedFormData: Partial<z.infer<typeof FullFormSchema>> = {
      ...currentFullFormSchemaCompliant,
    }

    delete updatedFormData.version_id

    if (updates.title !== undefined) updatedFormData.title = updates.title
    if (updates.description !== undefined)
      updatedFormData.description = updates.description
    if (updates.settings) {
      updatedFormData.settings = {
        ...(updatedFormData.settings || getDefaultSettings()),
        ...updates.settings,
      }
    }

    let newQuestionsArray: Question[] = [
      ...(currentFullFormSchemaCompliant.questions || []),
    ]
    if (updates.questions && updates.questions.length > 0) {
      for (const qUpdate of updates.questions) {
        if (qUpdate.action === "add") {
          const newQuestion = {
            ...qUpdate.questionData,
            id: qUpdate.questionData.id || nanoid(),
          } as Question
          newQuestionsArray.push(newQuestion)
        } else if (qUpdate.action === "update" && qUpdate.questionId) {
          newQuestionsArray = newQuestionsArray.map((q) =>
            q.id === qUpdate.questionId ? { ...q, ...qUpdate.questionData } : q
          ) as Question[]
        } else if (qUpdate.action === "remove" && qUpdate.questionId) {
          newQuestionsArray = newQuestionsArray.filter(
            (q) => q.id !== qUpdate.questionId
          )
        }
      }
    }
    updatedFormData.questions = newQuestionsArray
    logger.info(
      `[updateFormAgent] Applied updates and repaired questions for formId: ${formId}`
    )

    const rawQuestionsForValidation = updatedFormData.questions || []
    const settingsForValidation = updatedFormData.settings || {}

    const validatedQuestionsForSchema: Question[] = []
    for (const q of rawQuestionsForValidation) {
      const qValidationResult = QuestionSchema.safeParse(q)
      if (qValidationResult.success) {
        validatedQuestionsForSchema.push(qValidationResult.data)
      } else {
        logger.warn(
          `[updateFormAgent] Individual question validation failed for a question in formId ${formId}:`,
          qValidationResult.error.issues
        )
        validatedQuestionsForSchema.push(q as Question)
      }
    }

    const dataToValidate = {
      id: formId,
      version_id: nanoid(),
      title: updatedFormData.title!,
      description: updatedFormData.description,
      questions: validatedQuestionsForSchema,
      settings: settingsForValidation,
      current_draft_version_id: currentFormDbRecord.current_draft_version_id,
      short_id: currentFormDbRecord.short_id || undefined,
    }

    const validationResult = FullFormSchema.safeParse(dataToValidate)
    if (!validationResult.success) {
      const errorMessage = `Form validation failed: ${validationResult.error.issues.map((i) => i.message).join(", ")}`
      logger.error(
        `[updateFormAgent] ${errorMessage} for formId: ${formId}`,
        validationResult.error.issues
      )
      throw new Error(errorMessage)
    }
    const validatedFormPart = validationResult.data
    logger.info(
      `[updateFormAgent] Form data validated successfully for formId: ${formId}`
    )

    agentState.formMetadata = {
      title: validatedFormPart.title,
      description: validatedFormPart.description || "",
    }
    agentState.settings = validatedFormPart.settings

    yield createAgentEvent(
      "state_snapshot",
      "state",
      {
        form: buildFormForEvent(
          validatedFormPart,
          validatedFormPart.version_id
        ),
        agentState: { ...agentState },
        isComplete: false,
      },
      formId,
      userId,
      currentSequence++
    ) as StateSnapshotEvent
    agentState.eventSequence = currentSequence

    const newVersionPayload = {
      form_id: formId,
      user_id: userId,
      title: validatedFormPart.title as Json,
      description: validatedFormPart.description as Json,
      questions: validatedFormPart.questions as Json,
      settings: validatedFormPart.settings as Json,
      status: "draft" as const,
    }

    const { data: newVersion, error: newVersionError } = await supabase
      .from("form_versions")
      .insert(newVersionPayload)
      .select("version_id")
      .single()

    if (newVersionError || !newVersion) {
      throw new Error(
        `Failed to save new form version for formId ${formId}: ${newVersionError?.message}`
      )
    }
    logger.info(
      `[updateFormAgent] New form version created: ${newVersion.version_id} for formId: ${formId}`
    )

    const { error: formUpdateError } = await supabase
      .from("forms")
      .update({
        current_draft_version_id: newVersion.version_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", formId)

    if (formUpdateError) {
      logger.error(
        `[updateFormAgent] CRITICAL: Failed to update forms table for formId ${formId} to new version ${newVersion.version_id}: ${formUpdateError.message}. Manual intervention may be needed.`
      )
      throw new Error(
        `Failed to update form record with new version: ${formUpdateError.message}`
      )
    }
    logger.info(
      `[updateFormAgent] Form record updated to new draft version ${newVersion.version_id} for formId: ${formId}`
    )

    agentState.status = "COMPLETED"
    agentState.formMetadata = {
      title: validatedFormPart.title,
      description: validatedFormPart.description || "",
    }
    agentState.settings = validatedFormPart.settings

    yield createAgentEvent(
      "state_snapshot",
      "state",
      {
        form: buildFormForEvent(validatedFormPart, newVersion.version_id),
        agentState: { ...agentState, status: "COMPLETED" },
        isComplete: true,
      },
      formId,
      userId,
      currentSequence++
    ) as StateSnapshotEvent
    agentState.eventSequence = currentSequence
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(
      `[updateFormAgent] Error during form update for formId ${formId}:`,
      error
    )
    agentState.status = "FAILED"
    agentState.errorDetails = {
      node: "updateFormAgent",
      message: errorMessage,
      originalError: error,
    }

    const errorFormSnapshot = buildFormForEvent(
      agentState.formMetadata
        ? {
            title: agentState.formMetadata.title,
            description: agentState.formMetadata.description,
            questions: agentState.generatedQuestionSchemas,
            settings: agentState.settings
              ? (agentState.settings as any)
              : getDefaultSettings(),
          }
        : null
    )

    yield createAgentEvent(
      "agent_error",
      "error",
      { message: errorMessage, details: error, recoverable: false },
      formId,
      userId,
      currentSequence++
    )
    agentState.eventSequence = currentSequence

    yield createAgentEvent(
      "state_snapshot",
      "state",
      {
        form: errorFormSnapshot,
        agentState: { ...agentState },
        isComplete: true,
      },
      formId,
      userId,
      currentSequence++
    ) as StateSnapshotEvent
    agentState.eventSequence = currentSequence
  } finally {
    const finalStatus =
      agentState.status === "COMPLETED" ? "COMPLETED" : "FAILED"
    agentState.status = finalStatus

    yield createAgentEvent(
      "agent_finalized",
      "system",
      { message: `Update agent finalized with status: ${finalStatus}.` },
      formId,
      userId,
      currentSequence++
    )
    logger.info(
      `[updateFormAgent] Finalized for formId: ${formId} with status ${finalStatus}`
    )
  }
}
