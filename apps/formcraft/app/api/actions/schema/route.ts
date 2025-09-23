import { getToolSchema } from "@/app/lib/actions/schema-registry"
import { getModel } from "@/app/lib/ai/provider"
import logger from "@/app/lib/logger"
import { requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import { generateObject } from "ai"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

const querySchema = z.object({ slug: z.string().min(1) })

export async function GET(request: Request) {
  try {
    await requireAuth(request)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ slug: searchParams.get("slug") })
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid slug" },
      { status: 400 }
    )
  }

  const slug = parsed.data.slug
  try {
    const schema = await getToolSchema(slug)
    return NextResponse.json({ success: true, schema })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

const suggestBodySchema = z.object({
  formId: z.string().uuid(),
  slug: z.string().min(1),
  viewId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  let auth
  try {
    auth = await requireAuth(request)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 401 }
    )
  }

  const payload = await request.json().catch(() => null)
  const parsed = suggestBodySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { formId, slug } = parsed.data
  const ownership = await verifyUserOwnsForm(formId, auth.user.id)
  if (!ownership.formExists) {
    return NextResponse.json(
      { success: false, error: "Form not found" },
      { status: 404 }
    )
  }
  if (!ownership.isOwner) {
    return NextResponse.json(
      { success: false, error: "You do not have access to this form" },
      { status: 403 }
    )
  }

  const schema = await getToolSchema(slug)
  logger.info?.("[actions][schema] fetched tool schema", {
    slug,
    hasSchema: Boolean(schema),
  })

  // Fetch questions for context
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)
  const { data: formRow } = await (supabase as any)
    .from("forms")
    .select("current_published_version_id, current_draft_version_id")
    .eq("id", formId)
    .maybeSingle()
  const publishedId = (formRow as any)?.current_published_version_id
  const draftId = (formRow as any)?.current_draft_version_id
  const versionId = publishedId || draftId
  let questions: Array<{ id: string; label: string; type?: string }> = []
  if (versionId) {
    const { data: version } = await (supabase as any)
      .from("form_versions")
      .select("questions")
      .eq("version_id", versionId)
      .maybeSingle()
    const raw = (version as any)?.questions
    let arr: any[] = []
    if (Array.isArray(raw)) arr = raw
    else if (typeof raw === "string") {
      try {
        const parsedQ = JSON.parse(raw)
        if (Array.isArray(parsedQ)) arr = parsedQ
      } catch {}
    }
    questions = arr
      .filter((q) => q && q.id)
      .map((q) => ({
        id: q.id,
        label: q.label || q.title || q.id,
        type: q.type,
      }))
    logger.info?.("[actions][schema] loaded questions", {
      slug,
      count: questions.length,
    })
  }

  // AI suggestion: propose params object using schema + questions; use tokens {{answer:ID}} where helpful
  try {
    const model = getModel()
    // AI SDK here expects a Zod schema; use a thin wrapper and pass
    // the provider tool schema as context to steer structure.
    const Output = z.object({
      params: z.any(),
      rationale: z.string().optional(),
    })

    const { object } = await generateObject({
      model,
      schema: Output,
      temperature: 0,
      system: `You are an integration assistant. Propose a parameter object for the given tool using the provided tool JSON schema and available form questions.
Rules:
- Return an object { params, rationale? }.
- Make params conform to the tool schema (exact key names/shape) as closely as possible.
- For string fields, use templates with placeholders like {{answer:QUESTION_ID}}.
- For objects/arrays, construct practical structures and place placeholders where helpful.
- If a required identifier cannot be inferred, leave an empty string and explain in rationale.
Respond with JSON only.`,
      prompt: JSON.stringify({ slug, toolSchema: schema, questions }),
    })

    if (!object || typeof object !== "object") {
      logger.error?.("[actions][schema] LLM returned no object", { slug })
      return NextResponse.json(
        {
          success: false,
          error: "No object generated: could not parse the response.",
          schema,
        },
        { status: 502 }
      )
    }
    logger.info?.("[actions][schema] suggestion generated", {
      slug,
      hasParams: Boolean((object as any).params),
    })
    return NextResponse.json({ success: true, schema, suggestion: object })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error?.("[actions][schema] suggestion failed", {
      slug,
      error: message,
    })
    return NextResponse.json(
      { success: false, error: message, schema, suggestion: null },
      { status: 500 }
    )
  }
}
