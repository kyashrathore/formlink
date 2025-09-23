import logger from "@/app/lib/logger"

export type QuestionMeta = {
  id: string
  title?: string
  label?: string
  page?: number
  typeName?: string
  typeFormat?: string
}

export async function resolveFormVersionId(
  supabase: any,
  formId: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("forms")
      .select("current_published_version_id, current_draft_version_id")
      .eq("id", formId)
      .single()

    if (!data) return null

    return (
      (data as any).current_published_version_id ||
      (data as any).current_draft_version_id ||
      null
    )
  } catch (error) {
    logger.warn("[RI] Failed to resolve formVersionId", {
      formId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function loadFormQuestionsMeta(
  supabase: any,
  formVersionId: string
): Promise<{ questionIds: string[]; questionsMeta: QuestionMeta[] }> {
  try {
    const { data } = await supabase
      .from("form_versions")
      .select("questions")
      .eq("version_id", formVersionId)
      .single()

    const rawQuestions = (data as any)?.questions
    let parsed: unknown[] = []
    if (Array.isArray(rawQuestions)) {
      parsed = rawQuestions
    } else if (typeof rawQuestions === "string") {
      try {
        parsed = JSON.parse(rawQuestions)
      } catch (parseError) {
        logger.warn("[RI] Failed to parse form questions JSON", {
          formVersionId,
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        })
      }
    }

    const questionsMeta = (parsed as any[])
      .filter(
        (entry) =>
          entry && typeof entry === "object" && typeof entry.id === "string"
      )
      .map((entry) => ({
        id: entry.id as string,
        title: (entry as any).title,
        label: (entry as any).label,
        page: (entry as any).page,
        typeName: (entry as any)?.type?.name,
        typeFormat: (entry as any)?.type?.format,
      }))

    return {
      questionIds: questionsMeta.map((question) => question.id),
      questionsMeta,
    }
  } catch (error) {
    logger.warn("[RI] Failed to load form questions", {
      formVersionId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { questionIds: [], questionsMeta: [] }
  }
}
