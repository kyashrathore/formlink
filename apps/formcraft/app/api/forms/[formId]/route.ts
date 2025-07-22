import { parseFormSchema } from "@/app/lib"
import {
  CREATE_FORM_REPAIR_SYSTEM_PROMPT,
  CREATE_FORM_SYSTEM_PROMPT,
} from "@/app/lib/prompts"
import { getenv } from "@/lib/env"
import { createServerClient, Database, Json } from "@formlink/db"
import { Form, FormSchema } from "@formlink/schema"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateObject } from "ai"
import { customAlphabet } from "nanoid"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  10
)

const createFormSystemPrompt = CREATE_FORM_SYSTEM_PROMPT
const createFormRepairSystemPrompt = CREATE_FORM_REPAIR_SYSTEM_PROMPT

const openRouterProvider = createOpenRouter({
  apiKey: getenv("OPENROUTER_API_KEY") || "",
})

const MODEL = openRouterProvider("openai/gpt-4.1")

async function getFormSchemaById(
  formId: string,
  versionIdColumn: "current_published_version_id" | "current_draft_version_id",
  versionStatus: "published" | "draft",
  supabase: any
): Promise<Form | null> {
  const { data: formData, error: formError } = await supabase
    .from("forms")
    .select("current_published_version_id, current_draft_version_id")
    .eq("id", formId)
    .single()

  if (formError || !formData) {
    if (formError && formError.code !== "PGRST116") {
      // Supabase error fetching form
    }
    return null
  }

  const versionId = formData[versionIdColumn]

  if (!versionId) {
    // Form has no version set
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
      // Supabase error fetching version
    }
    return null
  }

  try {
    const v: any = versionData
    const formSchemaResult: Form = {
      id: formId,
      version_id: v.version_id,
      title: v.title,
      description: v.description,
      questions: v.questions,
      settings: v.settings,
      current_published_version_id: formData.current_published_version_id,
      current_draft_version_id: formData.current_draft_version_id,
    }
    return formSchemaResult
  } catch (castError) {
    // Error constructing form schema object
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const { requireAuth, authErrorResponse } = await import(
      "../../../lib/middleware/auth"
    )
    let authResult
    try {
      authResult = await requireAuth(req)
    } catch (error: any) {
      return authErrorResponse(error)
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

    // Use authenticated user's ID
    const userId = authResult.user.id
    const isGuest = authResult.isGuest

    // Check guest limits
    if (isGuest) {
      const { verifyGuestUserLimits } = await import(
        "../../../lib/middleware/authorization"
      )
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

    // Executing form creation API

    const promptContent = `Create a form about: ${userPrompt}. Generate proper questions, options, and validations.`
    let maxRepairTries = 3

    const repairFunction = async ({
      text,
      error,
    }: {
      text: string
      error: any
    }): Promise<string> => {
      maxRepairTries--
      // Trying to repair errored json
      const { object: repairedSchema }: { object: Form } =
        await generateObject<Form>({
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
        })
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
      // Supabase insert error (forms)
      throw new Error(
        formInsertError?.message || "Failed to create form entry."
      )
    }
    const form_id = formInsertData.id

    const newVersionId = uuidv4()

    const parsedSchema = parseFormSchema(initialSchema)
    const { title, questions, description, settings } = parsedSchema

    const questionsWithReadableLogic = questions.map((question) => {
      const readableValidations = question.validations
        ? Object.entries(question.validations)
            .map(
              ([key, value]) =>
                (value as { originalText?: string }).originalText
            )
            .filter(Boolean)
        : []
      const readableConditionalLogic = Array.isArray(question.conditionalLogic)
        ? question.conditionalLogic
            .map((cl: any) => cl.originalText)
            .filter(Boolean)
        : []

      return {
        ...question,
        readableValidations,
        readableConditionalLogic,
      }
    })

    const { data: versionInsertData, error: versionInsertError } =
      await supabase
        .from("form_versions")
        .insert({
          version_id: newVersionId,
          form_id: form_id,
          title: title,
          description: description as Json,
          questions: questionsWithReadableLogic as Json,
          settings: settings as Json,
          status: "draft",
        })
        .select("version_id")
        .single()

    if (versionInsertError || !versionInsertData) {
      // Supabase insert error (form_versions)
      await supabase.from("forms").delete().eq("id", form_id)
      throw new Error(
        versionInsertError?.message || "Failed to create form version entry."
      )
    }

    const form_version_id = versionInsertData.version_id

    // Created form_versions entry

    const { error: formUpdateError } = await supabase
      .from("forms")
      .update({ current_draft_version_id: form_version_id })
      .eq("id", form_id)

    if (formUpdateError) {
      // Supabase update error (forms - linking draft)

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
  } catch (error: any) {
    // Error in form creation API
    return NextResponse.json(
      { error: error.message || "Internal server error", originalError: error },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: any) {
  const formId = (await params).formId

  if (!formId) {
    return NextResponse.json({ error: "Form ID is required" }, { status: 400 })
  }

  try {
    const updates: Record<string, any> = await request.json()

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
      // Supabase error fetching form
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
        currentPublishedVersion,
        updatableFields
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
      // Supabase error updating version
      console.error("[API] Database update error:", versionError)
      return NextResponse.json({ error: versionError.message }, { status: 500 })
    }

    return NextResponse.json(versionData)
  } catch (error) {
    // API Error updating version for form
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

function validateMinorUpdate(
  currentVersion: any,
  updatesToApply: any
): string | null {
  if (updatesToApply.questions && currentVersion.questions) {
    const currentQuestions = currentVersion.questions as any[]
    const updatedQuestions = updatesToApply.questions as any[]

    if (currentQuestions.length !== updatedQuestions.length) {
      return "Cannot add or remove questions on a published form."
    }

    for (let i = 0; i < currentQuestions.length; i++) {
      if (currentQuestions[i].id !== updatedQuestions[i].id) {
        return "Reordering questions is not allowed on a published form."
      }
      if (
        currentQuestions[i].questionType !== updatedQuestions[i].questionType
      ) {
        return `Changing the type of question '${currentQuestions[i].title}' is not allowed.`
      }
    }
  }

  return null
}

export async function GET(request: Request, { params }: any) {
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
    // API Error fetching form schema
    console.error("[API] Error fetching form schema:", error)
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
