import { repairJSON } from "@/app/lib/ai/repair"
import logger from "@/app/lib/logger"
import { createServerClient, Database, TablesInsert } from "@formlink/db"
import { QuestionSchema, repairQuestionInputTypes } from "@formlink/schema"
import { z } from "zod"

/**
 * Interface for form finalization result
 */
export interface FormFinalizationResult {
  success: boolean
  newVersionId?: string
  error?: string
}

/**
 * Interface for progress streaming
 */
interface DataStream {
  writeData: (data: unknown) => void
}

/**
 * Interface for form content to be saved
 */
export interface FormContent {
  title: string
  description: string
  questions: unknown[]
  settings: Record<string, unknown>
  journeyScript?: string
}

/**
 * Interface for form finalization parameters
 */
export interface FinalizeFormParams {
  formId: string
  userId: string
  formContent: FormContent
  dataStream: DataStream
}

/**
 * Validation result interface
 */
interface ValidationResult {
  success: boolean
  data?: z.infer<typeof QuestionSchema>[]
  error?: string
}

/**
 * Validate and repair questions array
 * Extracted from finalizer.ts validation logic
 */
async function validateQuestions(
  questions: unknown[]
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

/**
 * Create a new form version in the database
 * Extracted from finalizer.ts core save logic
 */
async function createFormVersion(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  formId: string,
  userId: string,
  formContent: FormContent,
  validatedQuestions: z.infer<typeof QuestionSchema>[]
): Promise<{ success: boolean; versionId?: string; error?: unknown }> {
  logger.info(
    {
      hasJourneyScript: !!formContent.journeyScript,
      journeyScriptLength: formContent.journeyScript?.length,
      journeyScriptPreview: formContent.journeyScript?.substring(0, 100),
    },
    "Creating form version with journey script check"
  )

  const formVersionData: TablesInsert<"form_versions"> = {
    form_id: formId,
    title:
      validatedQuestions.length > 0
        ? formContent.title
        : "Untitled Form (No Questions)",
    description: formContent.description,
    questions:
      validatedQuestions as Database["public"]["Tables"]["form_versions"]["Insert"]["questions"],
    settings: (formContent.journeyScript
      ? {
          journeyScript: formContent.journeyScript,
        }
      : formContent.settings) as any,
    status: "draft",
    user_id: userId,
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

/**
 * Update the form record with the new version
 * Extracted from finalizer.ts database operations
 */
async function updateFormWithNewVersion(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  formId: string,
  newVersionId: string,
  validatedQuestions: z.infer<typeof QuestionSchema>[],
  validatedSettings: Record<string, unknown>
): Promise<{ success: boolean; error?: unknown }> {
  const finalAgentState = {
    formId,
    generatedQuestionSchemas: validatedQuestions,
    settings: validatedSettings,
    errorDetails: undefined,
    status: "COMPLETED" as const,
    updated_at: new Date().toISOString(),
  }

  const { error: formUpdateError } = await supabase
    .from("forms")
    .update({
      current_draft_version_id: newVersionId,
      agent_state:
        finalAgentState as unknown as Database["public"]["Tables"]["forms"]["Update"]["agent_state"],
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId)

  if (formUpdateError) {
    logger.error({ error: formUpdateError }, "Failed to update forms table")
    return { success: false, error: formUpdateError }
  }

  return { success: true }
}

/**
 * Finalize form by saving to database
 * Extracted from finalizer.ts core save logic
 * Removes Langchain BaseMessage/RunnableConfig types
 * Uses direct database operations
 *
 * @param params - Form finalization parameters
 * @returns Promise<FormFinalizationResult>
 */
export async function finalizeForm(
  params: FinalizeFormParams
): Promise<FormFinalizationResult> {
  const { formId, userId, formContent, dataStream } = params

  try {
    // Stream progress update
    dataStream.writeData({
      type: "progress",
      message: "Starting form finalization process...",
      step: "finalization_start",
      progress: 10,
    })

    // Initialize Supabase client
    let supabase: Awaited<ReturnType<typeof createServerClient>>
    try {
      supabase = await createServerClient(null, "service")
    } catch (e) {
      const errorMessage =
        "Failed to initialize Supabase client for DB operations."
      logger.error({ error: e }, errorMessage)

      dataStream.writeData({
        type: "error",
        message: errorMessage,
        step: "db_connection_error",
      })

      return {
        success: false,
        error: errorMessage,
      }
    }

    dataStream.writeData({
      type: "progress",
      message: "Validating form questions...",
      step: "validation",
      progress: 30,
    })

    // Validate questions
    const questionValidation = await validateQuestions(formContent.questions)
    if (!questionValidation.success) {
      const errorMessage =
        questionValidation.error || "Questions validation failed"

      dataStream.writeData({
        type: "error",
        message: errorMessage,
        step: "validation_error",
      })

      return {
        success: false,
        error: errorMessage,
      }
    }

    const validatedQuestions = questionValidation.data!

    dataStream.writeData({
      type: "progress",
      message: "Creating form version...",
      step: "version_creation",
      progress: 60,
    })

    // Create form version
    const versionCreation = await createFormVersion(
      supabase,
      formId,
      userId,
      formContent,
      validatedQuestions
    )

    if (!versionCreation.success) {
      const errorMessage = "Failed to create form version"

      dataStream.writeData({
        type: "error",
        message: errorMessage,
        step: "version_creation_error",
      })

      return {
        success: false,
        error: errorMessage,
      }
    }

    const newVersionId = versionCreation.versionId!

    dataStream.writeData({
      type: "progress",
      message: "Updating form record...",
      step: "form_update",
      progress: 80,
    })

    // Update form record
    const formUpdate = await updateFormWithNewVersion(
      supabase,
      formId,
      newVersionId,
      validatedQuestions,
      formContent.settings
    )

    if (!formUpdate.success) {
      logger.warn(
        { error: formUpdate.error },
        "Form update failed but version was created"
      )
      // Continue as this is not critical - version was created successfully
    }

    dataStream.writeData({
      type: "progress",
      message: `Form finalized successfully with ${validatedQuestions.length} questions`,
      step: "finalization_complete",
      progress: 100,
      newVersionId,
      questionCount: validatedQuestions.length,
    })

    logger.info(
      { formId, newVersionId, status: "COMPLETED" },
      "Form finalization completed successfully"
    )

    return {
      success: true,
      newVersionId,
    }
  } catch (error) {
    const errorMessage =
      (error as Error)?.message || "Unknown error during form finalization"

    logger.error({ error }, "Form finalization failed")

    dataStream.writeData({
      type: "error",
      message: "Form finalization failed",
      error: errorMessage,
      step: "finalization_error",
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}
