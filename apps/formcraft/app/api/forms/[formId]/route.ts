import { parseFormSchema } from "@/app/lib"
import { getModel } from "@/app/lib/ai/provider"
import { authErrorResponse, requireAuth } from "@/app/lib/middleware/auth"
import { verifyGuestUserLimits } from "@/app/lib/middleware/authorization"
import {
  CREATE_FORM_REPAIR_SYSTEM_PROMPT,
  CREATE_FORM_SYSTEM_PROMPT,
} from "@/app/lib/prompts"
import { createServerClient, SupabaseClient } from "@formlink/db"
import { Form, FormSchema } from "@formlink/schema"
import { generateObject } from "ai"
import { customAlphabet } from "nanoid"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  10
)

const createFormSystemPrompt = CREATE_FORM_SYSTEM_PROMPT
const createFormRepairSystemPrompt = CREATE_FORM_REPAIR_SYSTEM_PROMPT

// Removed - using provider utility instead

// Use provider utility - using vercel to avoid Azure issues
const MODEL = getModel("gpt-4", "vercel")

async function getFormSchemaById(
  formId: string,
  versionIdColumn: "current_published_version_id" | "current_draft_version_id",
  versionStatus: "published" | "draft",
  supabase: SupabaseClient
): Promise<Form | null> {
  const { data: formData, error: formError } = await supabase
    .from("forms")
    .select("current_published_version_id,short_id, current_draft_version_id")
    .eq("id", formId)
    .single()

  if (formError || !formData) {
    if (formError && formError.code !== "PGRST116") {
    }
    return null
  }

  const versionId = formData[versionIdColumn]

  if (!versionId) {
    return null
  }

  const { data: versionData, error: versionError } = await supabase
    .from("form_versions")
    .select("version_id, title, description, questions, settings")
    .eq("version_id", versionId)
    .eq("status", versionStatus)
    .single()

  if (versionError || !versionData) {
    if (versionError && versionError.code !== "PGRST116") {
    }
    return null
  }

  try {
    const v = versionData
    const formSchemaResult: Form = {
      id: formId,
      version_id: v.version_id,
      title: v.title,
      description: v.description,
      questions: v.questions,
      settings: v.settings,
      current_published_version_id: formData.current_published_version_id,
      current_draft_version_id: formData.current_draft_version_id,
      short_id: formData.short_id,
    }
    return formSchemaResult
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    let authResult
    try {
      authResult = await requireAuth(req)
    } catch (error) {
      return authErrorResponse({
        name: "AuthError",
        message:
          error instanceof Error ? error.message : "Authentication failed",
        statusCode: 401,
      })
    }

    const { userPrompt } = (await req.json()) as {
      userPrompt: string
    }

    if (!userPrompt) {
      return NextResponse.json(
        { error: "Error, missing userPrompt" },
        { status: 400 }
      )
    }

    const userId = authResult.user.id
    const isGuest = authResult.isGuest

    if (isGuest) {
      const { withinLimits, reason } = await verifyGuestUserLimits(userId)
      if (!withinLimits) {
        return NextResponse.json(
          { error: reason || "Guest user limits exceeded" },
          { status: 403 }
        )
      }
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)

    const promptContent = `Create a form about: ${userPrompt}. Generate proper questions, options, and validations.`
    let maxRepairTries = 3

    const repairFunction = async ({
      text,
      error,
    }: {
      text: string
      error: unknown
    }): Promise<string> => {
      maxRepairTries--

      const { object: repairedSchema }: { object: Form } = await generateObject(
        {
          model: MODEL,
          schema: FormSchema,
          system: createFormRepairSystemPrompt as string,
          experimental_repairText:
            maxRepairTries > 0 ? repairFunction : undefined,
          prompt: `
          Repair the following JSON schema based on the error: ${JSON.stringify(error)}
          Original prompt: ${promptContent}
          Erroneous json:
          ${text}`,
        }
      )
      return JSON.stringify(repairedSchema)
    }

    const { object: initialSchema }: { object: Form } = await generateObject({
      model: MODEL,
      schema: FormSchema,
      experimental_repairText: repairFunction,
      system: createFormSystemPrompt as string,
      prompt: promptContent,
    })
    const { data: formInsertData, error: formInsertError } = await supabase
      .from("forms")
      .insert({ user_id: userId, short_id: nanoid(7) })
      .select("id")
      .single()

    if (formInsertError || !formInsertData) {
      throw new Error(
        formInsertError?.message || "Failed to create form entry."
      )
    }
    const form_id = formInsertData.id

    const parsedSchema = parseFormSchema(initialSchema)
    const { title, questions, description, settings } = parsedSchema

    const questionsWithReadableLogic = questions.map((question) => {
      const readableValidations = question.validations
        ? Object.entries(question.validations)
            .map(
              ([, value]) => (value as { originalText?: string }).originalText
            )
            .filter(Boolean)
        : []
      const readableConditionalLogic = Array.isArray(question.conditionalLogic)
        ? question.conditionalLogic
            .map((cl) => (cl as { originalText?: string }).originalText)
            .filter(Boolean)
        : []

      return {
        ...question,
        readableValidations,
        readableConditionalLogic,
      }
    })

    const versionInsertPayload = {
      form_id: form_id,
      title: title as any,
      description: description as any,
      questions: questionsWithReadableLogic as any,
      settings: settings as any,
      status: "draft" as const,
    }

    const { data: versionInsertData, error: versionInsertError } =
      await supabase
        .from("form_versions")
        .insert(versionInsertPayload)
        .select("version_id")
        .single()

    if (versionInsertError || !versionInsertData) {
      await supabase.from("forms").delete().eq("id", form_id)
      throw new Error(
        versionInsertError?.message || "Failed to create form version entry."
      )
    }

    const form_version_id = versionInsertData.version_id

    const { error: formUpdateError } = await supabase
      .from("forms")
      .update({ current_draft_version_id: form_version_id })
      .eq("id", form_id)

    if (formUpdateError) {
      await supabase
        .from("form_versions")
        .delete()
        .eq("version_id", form_version_id)

      await supabase.from("forms").delete().eq("id", form_id)
      throw new Error(
        formUpdateError.message || "Failed to link draft version to form."
      )
    }

    return NextResponse.json(
      {
        success: true,
        form_id: form_id,
        form_version_id: form_version_id,
        title: parsedSchema.title,
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const formId = (await params).formId

  if (!formId) {
    return NextResponse.json({ error: "Form ID is required" }, { status: 400 })
  }

  try {
    const updates: Record<string, unknown> = await request.json()

    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }

    const {
      id,
      version_id,
      form_id,
      status,
      short_id,
      current_draft_version_id,
      current_published_version_id,
      ...updatableFields
    } = updates

    void id
    void version_id
    void form_id
    void status
    void short_id
    void current_draft_version_id
    void current_published_version_id

    if (Object.keys(updatableFields).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore, "service")

    const { data: formData, error: formError } = await supabase
      .from("forms")
      .select("current_draft_version_id, current_published_version_id")
      .eq("id", formId)
      .single()

    if (formError || !formData) {
      const msg = formError?.message || "Form not found"

      return NextResponse.json({ error: msg }, { status: 404 })
    }

    let targetVersionId: string | null = null
    let targetStatus: "draft" | "published" | null = null
    let isUpdatingPublishedDirectly = false

    if (formData.current_draft_version_id) {
      targetVersionId = formData.current_draft_version_id
      targetStatus = "draft"
    } else if (formData.current_published_version_id) {
      targetVersionId = formData.current_published_version_id
      targetStatus = "published"
      isUpdatingPublishedDirectly = true
    } else {
      return NextResponse.json(
        { error: "No active version to update" },
        { status: 404 }
      )
    }

    if (isUpdatingPublishedDirectly) {
      const { data: currentPublishedVersion, error: fetchError } =
        await supabase
          .from("form_versions")
          .select("questions, title, description, settings")
          .eq("version_id", targetVersionId)
          .eq("status", "published")
          .single()

      if (fetchError || !currentPublishedVersion) {
        return NextResponse.json(
          { error: "Failed to fetch current published version for validation" },
          { status: 500 }
        )
      }

      const validationError = validateMinorUpdate(
        currentPublishedVersion as any,
        updatableFields as any
      )
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
      }
    }

    const { data: versionData, error: versionError } = await supabase
      .from("form_versions")
      .update(updatableFields)
      .eq("version_id", targetVersionId)
      .eq("status", targetStatus)
      .select()
      .single()

    if (versionError) {
      return NextResponse.json({ error: versionError.message }, { status: 500 })
    }

    return NextResponse.json(versionData)
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

function validateMinorUpdate(
  currentVersion: {
    questions?: unknown[]
    title?: string
    description?: string
    settings?: unknown
  },
  updatesToApply: {
    questions?: unknown[]
    title?: string
    description?: string
    settings?: unknown
  }
): string | null {
  if (updatesToApply.questions && currentVersion.questions) {
    const currentQuestions = currentVersion.questions as Array<{
      id: string
      type: { name: string }
      title: string
    }>
    const updatedQuestions = updatesToApply.questions as Array<{
      id: string
      type: { name: string }
      title: string
    }>

    if (currentQuestions.length !== updatedQuestions.length) {
      return "Cannot add or remove questions on a published form."
    }

    for (let i = 0; i < currentQuestions.length; i++) {
      if (currentQuestions[i]?.id !== updatedQuestions[i]?.id) {
        return "Reordering questions is not allowed on a published form."
      }
      if (currentQuestions[i]?.type?.name !== updatedQuestions[i]?.type?.name) {
        return `Changing the type of question '${currentQuestions[i]?.title}' is not allowed.`
      }
    }
  }

  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const formId = (await params).formId

  if (!formId) {
    return NextResponse.json({ error: "Form ID is required" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  try {
    let formSchema: Form | null = null

    formSchema = await getFormSchemaById(
      formId,
      "current_published_version_id",
      "published",
      supabase
    )
    if (!formSchema) {
      formSchema = await getFormSchemaById(
        formId,
        "current_draft_version_id",
        "draft",
        supabase
      )
    }

    if (!formSchema) {
      return NextResponse.json(
        { error: `Form or requested version (published/draft) not found` },
        { status: 404 }
      )
    }

    return NextResponse.json(formSchema)
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
