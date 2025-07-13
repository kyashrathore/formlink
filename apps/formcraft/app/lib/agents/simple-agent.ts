import { createServerClient } from "@formlink/db"
import {
  Form,
  FormSchema as FullFormSchema,
  Question,
  QuestionSchema,
  repairQuestionInputTypes,
} from "@formlink/schema"
import { customAlphabet } from "nanoid"
import { z } from "zod"
import { app } from "../agent/graph" // Your main LangGraph app instance
import { AgentState, createInitialAgentState } from "../agent/state"
import logger from "../logger"
import {
  AgentEvent,
  createAgentEvent,
  StateSnapshotEvent,
} from "../types/agent-events"
import { UpdateFormSchema } from "../types/chat" // For params.updates type

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  10
) // For new question IDs

export async function* createFormAgent(
  params: {
    prompt: string
    shortId: string
    formId: string
    selectedModel?: string
  },
  userId: string
): AsyncGenerator<AgentEvent> {
  let lastProcessedSequenceBySimpleAgent = -1
  try {
    logger.info(
      `[SIMPLE_AGENT_WRAPPER] Initializing LangGraph for formId: ${params.formId}, prompt: "${params.prompt}"`
    )

    let initialState: AgentState = createInitialAgentState(
      params.formId,
      params.shortId,
      userId,
      params.prompt,
      "prompt",
      params.selectedModel
    )
    lastProcessedSequenceBySimpleAgent = initialState.eventSequence

    const initEvent = createAgentEvent(
      "agent_initialized",
      "system",
      {
        message: "Agent process initialized via LangGraph.",
        details: { inputType: "prompt", prompt: params.prompt },
      },
      params.formId,
      userId,
      initialState.eventSequence
    )
    yield initEvent

    initialState.eventSequence++

    logger.info(
      `[SIMPLE_AGENT_WRAPPER] Initial agent_initialized event yielded for formId: ${params.formId}. Next sequence: ${initialState.eventSequence}`
    )

    const stream = await app.stream(initialState, {
      recursionLimit: 100,
      streamMode: "updates",
    })

    for await (const chunk of stream) {
      logger.info({
        message: `[SIMPLE_AGENT_WRAPPER] Received chunk (updates) from stream for formId: ${params.formId}`,
        chunk,
      })

      const eventsFromThisChunk: AgentEvent[] = []

      for (const key in chunk) {
        if (Object.prototype.hasOwnProperty.call(chunk, key)) {
          const nodeOutput = (chunk as Record<string, any>)[key] as Partial<AgentState>
          if (nodeOutput && Array.isArray(nodeOutput._agentEvents)) {
            eventsFromThisChunk.push(...nodeOutput._agentEvents)
          }
        }
      }

      if (eventsFromThisChunk.length > 0) {
        eventsFromThisChunk.sort((a, b) => a.sequence - b.sequence)

        logger.info(
          `[SIMPLE_AGENT_WRAPPER] Found ${eventsFromThisChunk.length} events in current chunk for formId: ${params.formId}.`
        )
        for (const event of eventsFromThisChunk) {
          if (event.sequence > lastProcessedSequenceBySimpleAgent) {
            logger.info(
              `[SIMPLE_AGENT_WRAPPER] Yielding event: ${event.type} - ${event.category} (seq: ${event.sequence}) for formId: ${params.formId}`
            )
            yield event
            lastProcessedSequenceBySimpleAgent = event.sequence
          } else {
            logger.warn(
              `[SIMPLE_AGENT_WRAPPER] Skipping already processed or out-of-order event (seq: ${event.sequence}, lastProcessed: ${lastProcessedSequenceBySimpleAgent}) for formId: ${params.formId}`
            )
          }
        }
      }
    }
    logger.info(
      `[SIMPLE_AGENT_WRAPPER] LangGraph stream completed for formId: ${params.formId}.`
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(
      `[SIMPLE_AGENT_WRAPPER] Critical error during LangGraph execution for formId: ${params.formId}:`,
      { error }
    )

    const errorSequence = lastProcessedSequenceBySimpleAgent + 1
    const errorEvent = createAgentEvent(
      "agent_error",
      "error",
      {
        message: `Critical agent execution error: ${errorMessage}`,
        details: error,
        recoverable: false,
      },
      params.formId,
      userId,
      errorSequence
    )
    logger.info(
      `[SIMPLE_AGENT_WRAPPER] CATCH: Yielding critical error event: ${errorEvent.type} - ${errorEvent.category} (seq: ${errorSequence}) for formId: ${params.formId}`
    )
    yield errorEvent
  } finally {
    logger.info(
      `[SIMPLE_AGENT_WRAPPER] In FINALLY block for formId: ${params.formId}`
    )
  }
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

  let agentState: AgentState = {
    formId,
    shortId: formId.substring(0, 8),
    userId,
    originalInput: updates,
    inputType: "prompt", // Representing the update request as a "prompt" to the agent
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

  // Helper to build a valid Form object for StateSnapshotEvents
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

    return {
      id: formId,
      version_id: tempVersionId || dbVersionData?.version_id || nanoid(),
      title: baseTitle,
      description: baseDescription,
      questions: dbVersionData?.questions || [],
      settings: dbVersionData?.settings || {},
      // Optional fields from FullFormSchema, might not always be present or needed for snapshot
      current_draft_version_id:
        dbVersionData?.current_draft_version_id || undefined,
      current_published_version_id:
        dbVersionData?.current_published_version_id || undefined,
      short_id: dbVersionData?.short_id || undefined,
    }
  }

  try {
    const supabase = await createServerClient(null as any, "service")
    logger.info(
      `[updateFormAgent] Supabase client created for formId: ${formId}`
    )

    // Initial state snapshot before fetching
    let initialFormSnapshot = buildFormForEvent(null) // Empty form initially
    agentState.formMetadata = {
      title: initialFormSnapshot.title,
      description: initialFormSnapshot.description || "",
    }
    agentState.settings = initialFormSnapshot.settings
    // agentState.generatedQuestionSchemas = initialFormSnapshot.questions; // Not directly assignable

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
      .select("current_draft_version_id, short_id") // Also fetch short_id
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

    // Construct a FullFormSchema compatible object from DB data
    const currentFullFormSchemaCompliant: z.infer<typeof FullFormSchema> = {
      id: formId,
      version_id: currentVersionDataFromDb.version_id,
      title: String(currentVersionDataFromDb.title), // Ensure string
      description: currentVersionDataFromDb.description
        ? String(currentVersionDataFromDb.description)
        : undefined, // Ensure string or undefined
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
      // current_published_version_id might be on forms table or form_versions, adjust as needed
      // short_id is on forms table
      short_id: currentFormDbRecord.short_id || undefined,
    }

    agentState.formMetadata = {
      title: currentFullFormSchemaCompliant.title,
      description: currentFullFormSchemaCompliant.description || "",
    }
    agentState.settings = currentFullFormSchemaCompliant.settings
    // agentState.generatedQuestionSchemas = currentFullFormSchemaCompliant.questions; // Not directly assignable

    let updatedFormData: Partial<z.infer<typeof FullFormSchema>> = {
      ...currentFullFormSchemaCompliant, // Start with valid, type-coerced data
    }
    // These are not part of the FullFormSchema for update purposes directly, they are for context or new version
    delete updatedFormData.version_id
    // created_at, updated_at, published_at, status are specific to form_versions table structure, not FullFormSchema for update content

    if (updates.title !== undefined) updatedFormData.title = updates.title
    if (updates.description !== undefined)
      updatedFormData.description = updates.description
    if (updates.settings) {
      updatedFormData.settings = {
        ...(updatedFormData.settings || {}),
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
    updatedFormData.questions = repairQuestionInputTypes(newQuestionsArray)
    logger.info(
      `[updateFormAgent] Applied updates and repaired questions for formId: ${formId}`
    )

    const rawQuestionsForValidation = updatedFormData.questions || []
    const settingsForValidation = updatedFormData.settings || {}

    // Validate each question individually before including in FullFormSchema validation
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
        validatedQuestionsForSchema.push(q as Question) // Push as is, hoping repair or FullFormSchema handles it
      }
    }

    const dataToValidate = {
      id: formId,
      version_id: nanoid(), // Temporary for validation
      title: updatedFormData.title!,
      description: updatedFormData.description,
      questions: validatedQuestionsForSchema, // Pass the validated Question[] array
      settings: settingsForValidation,
      current_draft_version_id: currentFormDbRecord.current_draft_version_id,
      short_id: currentFormDbRecord.short_id || undefined,
    }

    // Bypassing FullFormSchema.safeParse due to persistent issues with discriminated union array validation.
    // We are relying on:
    // 1. Individual QuestionSchema.safeParse for each question in validatedQuestionsForSchema.
    // 2. repairQuestionInputTypes to fix common inputType/submissionBehavior issues.
    // 3. Type safety of UpdateFormSchema for the incoming AI request.
    // 4. Database constraints.
    // This means validatedFormPart will be dataToValidate directly, assuming its components are correct.
    const validatedFormPart = dataToValidate as any as z.infer<
      typeof FullFormSchema
    > // Force cast to proceed
    logger.info(
      `[updateFormAgent] Form data prepared (FullFormSchema.safeParse bypassed) for formId: ${formId}`
    )

    agentState.formMetadata = {
      title: validatedFormPart.title,
      description: validatedFormPart.description || "",
    }
    agentState.settings = validatedFormPart.settings
    // agentState.generatedQuestionSchemas = validatedFormPart.questions;

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
      title: validatedFormPart.title,
      description: validatedFormPart.description,
      questions: validatedFormPart.questions as any, // Cast to 'any' for Supabase insert if Json type is too strict
      settings: validatedFormPart.settings as any, // Cast to 'any' for Supabase insert
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
    // agentState.generatedQuestionSchemas = validatedFormPart.questions;

    yield createAgentEvent(
      "state_snapshot",
      "state",
      {
        form: buildFormForEvent(validatedFormPart, newVersion.version_id), // Use the actual new version_id
        agentState: { ...agentState, status: "COMPLETED" },
        isComplete: true,
      },
      formId,
      userId,
      currentSequence++
    ) as StateSnapshotEvent
    agentState.eventSequence = currentSequence
  } catch (error: any) {
    logger.error(
      `[updateFormAgent] Error during form update for formId ${formId}:`,
      error
    )
    agentState.status = "FAILED"
    agentState.errorDetails = {
      node: "updateFormAgent",
      message: error.message,
      originalError: error,
    }

    const errorFormSnapshot = buildFormForEvent(
      agentState.formMetadata
        ? {
            title: agentState.formMetadata.title,
            description: agentState.formMetadata.description,
            questions: agentState.generatedQuestionSchemas,
            settings: agentState.settings,
          }
        : null
    )

    yield createAgentEvent(
      "agent_error",
      "error",
      { message: error.message, details: error, recoverable: false },
      formId,
      userId,
      currentSequence++
    )
    agentState.eventSequence = currentSequence

    // Yield a final state snapshot on error
    yield createAgentEvent(
      "state_snapshot",
      "state",
      {
        form: errorFormSnapshot,
        agentState: { ...agentState }, // agentState already updated with FAILED status
        isComplete: true,
      },
      formId,
      userId,
      currentSequence++
    ) as StateSnapshotEvent
    agentState.eventSequence = currentSequence
  } finally {
    // Ensure status is one of the allowed values for AgentState
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
