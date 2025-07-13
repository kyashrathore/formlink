import { customAlphabet } from "nanoid"
import logger from "../../logger"

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  10
)

export class FormService {
  constructor(private supabase: any) {}

  async createNewForm(
    formId: string,
    userId: string
  ): Promise<{ formId: string; shortId: string }> {
    logger.info(`Creating new form. Client ID: ${formId}`)

    const shortId = nanoid()
    const timestamp = new Date().toISOString()

    const { error: formsInsertError } = await this.supabase
      .from("forms")
      .insert({
        id: formId,
        user_id: userId,
        short_id: shortId,
        agent_state: {
          formId,
          userId,
          status: "INITIALIZING",
        } as any,
        created_at: timestamp,
        updated_at: timestamp,
      })

    if (formsInsertError) {
      logger.error(`Error inserting new form ${formId}:`, formsInsertError)
      throw new Error(
        `Failed to create form record: ${formsInsertError.message}`
      )
    }

    const { data: initialVersionData, error: initialVersionError } =
      await this.supabase
        .from("form_versions")
        .insert({
          form_id: formId,
          user_id: userId,
          title: "Untitled Form",
          description: "",
          questions: [],
          settings: {},
          status: "draft" as const,
          created_at: timestamp,
          updated_at: timestamp,
        })
        .select("version_id")
        .single()

    if (initialVersionError || !initialVersionData) {
      logger.error(
        `Error creating initial form version for ${formId}:`,
        initialVersionError
      )
      throw new Error(
        `Failed to create initial form version: ${initialVersionError?.message}`
      )
    }

    const { error: formsUpdateError } = await this.supabase
      .from("forms")
      .update({ current_draft_version_id: initialVersionData.version_id })
      .eq("id", formId)

    if (formsUpdateError) {
      logger.error(
        `Error linking initial version for ${formId}:`,
        formsUpdateError
      )
      throw new Error(
        `Failed to link initial form version: ${formsUpdateError.message}`
      )
    }

    logger.info(`Form ${formId} and initial version created successfully`)

    // Verify form was actually created
    const { data: verifyForm, error: verifyError } = await this.supabase
      .from("forms")
      .select("id, short_id")
      .eq("id", formId)
      .single()

    if (verifyError || !verifyForm) {
      logger.error(`Failed to verify form creation`, { formId, verifyError })
      throw new Error(
        `Form creation verification failed: ${verifyError?.message || "Form not found"}`
      )
    }

    logger.info(
      `Form ${formId} verified successfully with shortId ${verifyForm.short_id}`
    )
    return { formId, shortId }
  }

  async ensureFormExists(
    formId: string,
    userId: string
  ): Promise<{ formId: string; shortId: string }> {
    logger.info(
      `[FormService.ensureFormExists] Checking form ${formId} for user ${userId}`
    )

    const { data: existingForm, error: fetchError } = await this.supabase
      .from("forms")
      .select("id, user_id, agent_state, short_id")
      .eq("id", formId)
      .maybeSingle()

    if (fetchError) {
      logger.error("Error fetching form", { formId, error: fetchError })
      throw new Error(`Failed to check form existence: ${fetchError.message}`)
    }

    if (!existingForm) {
      logger.info(
        `[FormService.ensureFormExists] Form ${formId} doesn't exist, creating new form`
      )
      return await this.createNewForm(formId, userId)
    }

    logger.info(
      `[FormService.ensureFormExists] Form ${formId} already exists with shortId ${existingForm.short_id}`
    )
    return { formId, shortId: existingForm.short_id }
  }

  async getFormContext(formId: string): Promise<any> {
    logger.info(
      `[FormService] Attempting to fetch context for formId: ${formId}`
    )

    const { data: formRec, error: fError } = await this.supabase
      .from("forms")
      .select("current_draft_version_id, short_id")
      .eq("id", formId)
      .single()

    if (fError) {
      logger.error(
        `[FormService] Error fetching form record for ${formId}:`,
        fError.message
      )
      throw fError
    }

    if (!formRec || !formRec.current_draft_version_id) {
      logger.warn(
        `[FormService] Form record or draft version not found for ${formId}.`
      )
      return null
    }

    const { data: versionData, error: vError } = await this.supabase
      .from("form_versions")
      .select("title, description, questions, settings")
      .eq("version_id", formRec.current_draft_version_id)
      .single()

    if (vError) {
      logger.error(
        `[FormService] Error fetching form version for ${formId}:`,
        vError.message
      )
      throw vError
    }

    if (!versionData) {
      logger.warn(`[FormService] Form version data not found for ${formId}.`)
      return null
    }

    const questionsSummary = ((versionData.questions as any[]) || []).map(
      (q, index) => ({
        questionNumber: index + 1,
        id: q.id,
        type: q.questionType,
        title: q.title,
        options: q.options
          ? (q.options as any[]).map((opt) => opt.label || opt.value)
          : undefined,
        ratingConfig: q.ratingConfig
          ? { min: q.ratingConfig.min, max: q.ratingConfig.max }
          : undefined,
      })
    )

    return {
      formId,
      shortId: formRec.short_id,
      title: versionData.title,
      description: versionData.description,
      questions: questionsSummary,
      settings: versionData.settings,
    }
  }
}
