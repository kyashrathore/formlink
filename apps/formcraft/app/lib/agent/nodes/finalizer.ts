import { repairJSON } from "@/app/lib/ai/repair"
import logger from "@/app/lib/logger"
import { getEnvVars, getRequiredEnvVar } from "@/app/lib/utils/env"
import { createServerClient, Database, TablesInsert } from "@formlink/db"
import {
  Form,
  QuestionSchema,
  repairQuestionInputTypes,
  SettingsSchema,
} from "@formlink/schema"
import { BaseMessage } from "@langchain/core/messages"
import { RunnableConfig } from "@langchain/core/runnables"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { z } from "zod"
import { MODEL_DEFAULT } from "../../config"
import { FINAL_MARKDOWN_PROMPT } from "../../prompts"
import { AgentEvent, createAgentEvent } from "../../types/agent-events"
import { AgentState } from "../state"
import { buildFormFromState } from "../utils/form-builder"

const NODE_NAME = "finalizeFormNode"

const FinalMarkdownResponseSchema = z.object({
  markdownContent: z.string().min(1, "Markdown content cannot be empty."),
})

interface FormContent {
  title: string
  description: string
  questions: any[]
  settings: any
}

interface ValidationResult {
  success: boolean
  data?: any
  error?: any
}

interface FinalizationResult {
  success: boolean
  newVersionId?: string
  resultPageContent?: string
  errorDetails?: {
    node: string
    message: string
    originalError?: any
  }
  messages: BaseMessage[]
}

async function createSupabaseClient() {
  return await createServerClient(null, "service")
}

function shouldSkipFinalization(state: AgentState): boolean {
  return !!(state.errorDetails || state.status === "FAILED")
}

function createFormContent(state: AgentState): FormContent {
  return {
    title: state.formMetadata?.title || "Untitled Form",
    description: state.formMetadata?.description || "",
    questions: state.generatedQuestionSchemas || [],
    settings: state.settings || {},
  }
}

async function validateQuestions(
  questions: any[],
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  state: AgentState
): Promise<ValidationResult> {
  const potentiallyRepairedQuestions = repairQuestionInputTypes(questions)
  const initialValidation = z
    .array(QuestionSchema)
    .safeParse(potentiallyRepairedQuestions)

  if (initialValidation.success) {
    return { success: true, data: initialValidation.data }
  }

  logger.warn(
    { error: initialValidation.error.format() },
    "Initial questions validation failed, attempting AI repair"
  )

  try {
    const repairedQuestions = await repairJSON(
      potentiallyRepairedQuestions,
      z.array(QuestionSchema),
      initialValidation.error
    )

    if (!repairedQuestions) {
      return {
        success: false,
        error: "AI repair process failed to return a result",
      }
    }

    const repairedValidation = z
      .array(QuestionSchema)
      .safeParse(repairedQuestions)

    if (repairedValidation.success) {
      logger.info("AI repair for questions schema successful")
      return { success: true, data: repairedValidation.data }
    }

    return {
      success: false,
      error: "Final questions validation failed after AI repair attempt",
    }
  } catch (error) {
    logger.error({ error }, "AI repair process threw an error")
    return {
      success: false,
      error: "AI repair process failed with exception",
    }
  }
}

async function generateResultPageContent(
  state: AgentState,
  validatedQuestions: any[]
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    // If we have a journey script, it already contains result generation instructions
    // The finalizer will save the entire journey script which includes result generation
    // For backward compatibility, only generate result page content if no journey script exists
    if (state.journeyScript) {
      // Journey script contains result generation, no need to generate separately
      return { success: true, content: "" }
    }

    // Fall back to original generation method if no journey script
    const allEnv = getEnvVars()
    const apiKey = getRequiredEnvVar("OPENROUTER_API_KEY", allEnv)
    const openRouterProvider = createOpenRouter({ apiKey })
    const MODEL = openRouterProvider(state.selectedModel || MODEL_DEFAULT)

    const markdownSystemPromptTemplate = FINAL_MARKDOWN_PROMPT || ""
    const formTitle = state.formMetadata?.title ?? "Untitled Form"
    const formDescription = state.formMetadata?.description ?? "No description."

    const populatedPrompt = markdownSystemPromptTemplate
      .replace(/{{formTitle}}/g, formTitle)
      .replace(/{{formDescription}}/g, formDescription)
      .replace(
        /{{questionSchemas}}/g,
        JSON.stringify(validatedQuestions, null, 2)
      )

    const result = await generateObject({
      model: MODEL,
      schema: FinalMarkdownResponseSchema,
      system: populatedPrompt,
      prompt: `Generate the final summary or result page content for a form titled "${formTitle}".`,
    })

    if (!result?.object?.markdownContent) {
      return {
        success: false,
        error: "AI call for final markdown generation failed",
      }
    }

    return { success: true, content: result.object.markdownContent }
  } catch (error: any) {
    logger.error({ error }, "Final markdown generation failed")
    return {
      success: false,
      error: error?.message || "Unknown error during markdown generation",
    }
  }
}

async function createFormVersion(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  state: AgentState,
  formContent: FormContent,
  validatedQuestions: any[],
  resultPageContent: string
): Promise<{ success: boolean; versionId?: string; error?: any }> {
  logger.info(
    {
      hasJourneyScript: !!state.journeyScript,
      journeyScriptLength: state.journeyScript?.length,
      journeyScriptPreview: state.journeyScript?.substring(0, 100),
    },
    "Creating form version with journey script check"
  )

  const formVersionData: TablesInsert<"form_versions"> = {
    form_id: state.formId,
    title:
      validatedQuestions.length > 0
        ? formContent.title
        : "Untitled Form (No Questions)",
    description: formContent.description,
    questions: validatedQuestions as any,
    settings: state.journeyScript
      ? {
          journeyScript: state.journeyScript,
        }
      : {
          resultPageGenerationPrompt: resultPageContent,
        },
    status: "draft",
    user_id: state.userId,
  }

  const { data: versionData, error: versionError } = await supabase
    .from("form_versions")
    .insert(formVersionData)
    .select("version_id")
    .single()

  if (versionError || !versionData) {
    logger.error({ error: versionError }, "Failed to create form version")
    return { success: false, error: versionError }
  }

  return { success: true, versionId: versionData.version_id }
}

async function updateFormWithNewVersion(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  state: AgentState,
  newVersionId: string,
  validatedQuestions: any[],
  validatedSettings: any,
  messages: BaseMessage[]
): Promise<{ success: boolean; error?: any }> {
  const agentMessagesForDb = messages.map((msg) => ({
    content: msg.content,
    type: msg._getType(),
  }))

  const finalAgentState = {
    ...state,
    generatedQuestionSchemas: validatedQuestions,
    settings: validatedSettings,
    agentMessages: agentMessagesForDb,
    errorDetails: undefined,
    status: "COMPLETED" as const,
    updated_at: new Date().toISOString(),
  }

  const { _agentEvents, ...stateToSave } = finalAgentState

  const { error: formUpdateError } = await supabase
    .from("forms")
    .update({
      current_draft_version_id: newVersionId,
      agent_state: stateToSave as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.formId)

  if (formUpdateError) {
    logger.error({ error: formUpdateError }, "Failed to update forms table")
    return { success: false, error: formUpdateError }
  }

  return { success: true }
}

function createFinalizationEvents(
  state: AgentState,
  result: FinalizationResult,
  currentSequence: number
): AgentEvent[] {
  const events: AgentEvent[] = []

  if (result.success && result.newVersionId) {
    const formTitle = state.formMetadata?.title || "Your form"
    const questionCount = state.generatedQuestionSchemas?.length || 0

    events.push(
      createAgentEvent(
        "task_completed",
        "progress",
        {
          taskId: `${NODE_NAME}_${state.formId}`,
          taskType: "form_finalization",
          current: 1,
          total: 1,
          message: "Form finalization completed successfully.",
          output: {
            newVersionId: result.newVersionId,
            title: formTitle,
            questionCount,
          },
        },
        state.formId,
        state.userId,
        currentSequence++
      )
    )

    events.push(
      createAgentEvent(
        "agent_finalized",
        "system",
        {
          message: `Form "${formTitle}" finalized successfully with new version ${result.newVersionId}.`,
          details: {
            newVersionId: result.newVersionId,
            questionCount,
          },
        },
        state.formId,
        state.userId,
        currentSequence++
      )
    )
  } else {
    events.push(
      createAgentEvent(
        "task_failed",
        "progress",
        {
          taskId: `${NODE_NAME}_${state.formId}`,
          taskType: "form_finalization",
          current: 1,
          total: 1,
          message: result.errorDetails?.message || "Form finalization failed",
        },
        state.formId,
        state.userId,
        currentSequence++
      )
    )

    events.push(
      createAgentEvent(
        "agent_error",
        "error",
        {
          message: result.errorDetails?.message || "Form finalization failed",
          details: result.errorDetails?.originalError,
          recoverable: false,
        },
        state.formId,
        state.userId,
        currentSequence++
      )
    )
  }

  return events
}

async function processFormFinalization(
  state: AgentState
): Promise<FinalizationResult> {
  const messages: BaseMessage[] = [...(state.agentMessages ?? [])]

  let supabase: Awaited<ReturnType<typeof createSupabaseClient>>
  try {
    supabase = await createSupabaseClient()
  } catch (e) {
    const errorMessage =
      "Failed to initialize Supabase client for DB operations."
    logger.error({ error: e }, errorMessage)

    return {
      success: false,
      errorDetails: {
        node: NODE_NAME,
        message: errorMessage,
        originalError: e instanceof Error ? e : new Error(String(e)),
      },
      messages,
    }
  }

  const formContent = createFormContent(state)

  // Validate questions
  const questionValidation = await validateQuestions(
    formContent.questions,
    supabase,
    state
  )
  if (!questionValidation.success) {
    const errorMessage =
      questionValidation.error || "Questions validation failed"

    return {
      success: false,
      errorDetails: {
        node: NODE_NAME,
        message: errorMessage,
        originalError: questionValidation.error,
      },
      messages,
    }
  }

  const validatedQuestions = questionValidation.data

  // Generate result page content
  const resultPageGeneration = await generateResultPageContent(
    state,
    validatedQuestions
  )

  if (!resultPageGeneration.success) {
    const errorMessage =
      resultPageGeneration.error || "Result page generation failed"

    return {
      success: false,
      errorDetails: {
        node: NODE_NAME,
        message: errorMessage,
        originalError: new Error(errorMessage),
      },
      messages,
    }
  }

  // Create form version
  const versionCreation = await createFormVersion(
    supabase,
    state,
    formContent,
    validatedQuestions,
    resultPageGeneration.content!
  )

  if (!versionCreation.success) {
    const errorMessage = "Failed to create form version"

    return {
      success: false,
      errorDetails: {
        node: NODE_NAME,
        message: errorMessage,
        originalError: versionCreation.error,
      },
      messages,
    }
  }

  const newVersionId = versionCreation.versionId!

  // Update form with new version
  const formUpdate = await updateFormWithNewVersion(
    supabase,
    state,
    newVersionId,
    validatedQuestions,
    formContent.settings,
    messages
  )

  if (!formUpdate.success) {
    // This is a partial failure - version was created but form wasn't updated
    logger.warn(
      { error: formUpdate.error },
      "Form update failed but version was created"
    )
  }

  logger.info(
    { formId: state.formId, newVersionId, status: "COMPLETED" },
    `${NODE_NAME}: EXIT SUCCESS`
  )

  return {
    success: true,
    newVersionId,
    resultPageContent: resultPageGeneration.content!,
    messages,
  }
}

export async function finalizeFormNode(
  state: AgentState,
  config?: RunnableConfig
): Promise<Partial<AgentState>> {
  const _agentEvents: AgentEvent[] = []
  let currentEventSequence = state.eventSequence

  logger.info(
    {
      message: `[${NODE_NAME}] Full config object received`,
      configReceived: config,
      formIdFromState: state.formId,
    },
    `[${NODE_NAME}] Full config object received`
  )

  // Check if we should skip finalization due to prior errors
  if (shouldSkipFinalization(state)) {
    logger.warn(
      {
        errorDetails: state.errorDetails,
        status: state.status,
      },
      `${NODE_NAME}: Propagating pre-existing error or FAILED status`
    )

    _agentEvents.push(
      createAgentEvent(
        "agent_error",
        "error",
        {
          message:
            state.errorDetails?.message ||
            "Finalization skipped due to prior failure.",
          details: state.errorDetails?.originalError,
          recoverable: false,
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    _agentEvents.push(
      createAgentEvent(
        "task_failed",
        "progress",
        {
          taskId: `${NODE_NAME}_${state.formId}`,
          taskType: "form_finalization",
          current: 1,
          total: 1,
          message:
            state.errorDetails?.message ||
            "Finalization skipped due to prior failure.",
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    const { _agentEvents: __, ...stateForSnapshot } = state
    _agentEvents.push(
      createAgentEvent(
        "state_snapshot",
        "state",
        {
          form: buildFormFromState(stateForSnapshot),
          agentState: stateForSnapshot,
          isComplete: true,
        },
        state.formId,
        state.userId,
        currentEventSequence++
      )
    )

    return {
      agentMessages: state.agentMessages ?? [],
      errorDetails: state.errorDetails,
      status: "FAILED" as const,
      _agentEvents,
      eventSequence: currentEventSequence,
    }
  }

  // Start finalization process
  _agentEvents.push(
    createAgentEvent(
      "task_started",
      "progress",
      {
        taskId: `${NODE_NAME}_${state.formId}`,
        taskType: "form_finalization",
        current: 0,
        total: 1,
        message: "Starting form finalization process...",
      },
      state.formId,
      state.userId,
      currentEventSequence++
    )
  )

  const result = await processFormFinalization(state)

  const finalizationEvents = createFinalizationEvents(
    state,
    result,
    currentEventSequence
  )
  _agentEvents.push(...finalizationEvents)
  currentEventSequence += finalizationEvents.length

  // Create final state snapshot
  const finalState = {
    ...state,
    agentMessages: result.messages,
    errorDetails: result.errorDetails,
    status: result.success ? ("COMPLETED" as const) : ("FAILED" as const),
    resultPageGenerationPrompt: result.resultPageContent,
    eventSequence: currentEventSequence,
  }

  const { _agentEvents: __, ...stateForSnapshot } = finalState
  _agentEvents.push(
    createAgentEvent(
      "state_snapshot",
      "state",
      {
        form: buildFormFromState(stateForSnapshot),
        agentState: stateForSnapshot,
        isComplete: true,
      },
      state.formId,
      state.userId,
      currentEventSequence++
    )
  )

  return {
    agentMessages: result.messages,
    errorDetails: result.errorDetails,
    status: result.success ? "COMPLETED" : "FAILED",
    resultPageGenerationPrompt: result.resultPageContent,
    _agentEvents,
    eventSequence: currentEventSequence,
  }
}
