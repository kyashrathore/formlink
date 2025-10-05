import { requireAuth } from "@/app/lib/middleware/auth"
import { verifyUserOwnsForm } from "@/app/lib/middleware/authorization"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const GuardrailsSchema = z
  .object({
    skipTestmode: z.boolean().optional(),
    maxActionsPerSubmission: z.number().int().positive().max(20).optional(),
    cooldownSeconds: z.number().int().nonnegative().optional(),
  })
  .strict()

const AllowedActionSchema = z
  .object({
    slug: z.string().min(1),
    provider: z.enum(["usesend", "composio"]),
    params: z.record(z.any()).default({}),
  })
  .strict()

const LifecycleConfigSchema = z
  .object({
    enabled: z.boolean(),
    guardrails: GuardrailsSchema.optional(),
    sidecarKeys: z.array(z.string()).optional(),
    allowedActions: z.array(AllowedActionSchema).default([]),
    orchestratorPrompt: z.string().max(4000).optional(),
    enabledHooks: z
      .array(z.enum(["spam", "enrichment", "lead", "tags"]))
      .optional(),
    tagVocabulary: z.array(z.string()).optional(),
  })
  .strict()

const DEFAULT_CONFIG = {
  enabled: false,
  guardrails: {
    skipTestmode: true,
    maxActionsPerSubmission: 3,
  },
  sidecarKeys: [],
  allowedActions: [],
  orchestratorPrompt: "",
  enabledHooks: ["spam", "enrichment", "lead", "tags"],
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params
    const auth = await requireAuth(req)
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

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const { data, error } = await supabase
      .from("forms")
      .select("agent_state")
      .eq("id", formId)
      .maybeSingle()

    if (error) {
      throw error
    }

    const agentState =
      (data?.agent_state as Record<string, unknown> | null) || {}
    const lifecycle =
      (agentState.lifecycle_v1 as Record<string, unknown> | null) || {}
    // Back-compat mapping: if stored state still uses enabledTools, map it
    // Coerce null/undefined guardrails from older rows to an empty object before spreading
    const rawGuardrails = (lifecycle as any).guardrails
    const normalizedGuardrails =
      rawGuardrails &&
      typeof rawGuardrails === "object" &&
      !Array.isArray(rawGuardrails)
        ? (rawGuardrails as Record<string, unknown>)
        : {}

    const normalized = {
      ...DEFAULT_CONFIG,
      ...lifecycle,
      guardrails: {
        ...DEFAULT_CONFIG.guardrails,
        ...normalizedGuardrails,
      },
      ...(lifecycle.enabledTools && !(lifecycle as any).enabledHooks
        ? { enabledHooks: lifecycle.enabledTools }
        : {}),
    }
    const parsed = LifecycleConfigSchema.safeParse(normalized)

    const config = parsed.success ? parsed.data : DEFAULT_CONFIG

    return NextResponse.json({ success: true, config })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params
    const auth = await requireAuth(req)
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

    const rawPayload = await req.json().catch(() => ({}) as any)
    // Back-compat: map enabledTools -> enabledHooks if present
    const payload = {
      ...rawPayload,
      ...(rawPayload && rawPayload.enabledTools && !rawPayload.enabledHooks
        ? { enabledHooks: rawPayload.enabledTools }
        : {}),
    }
    const parsed = LifecycleConfigSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload",
          issues: parsed.error.issues,
        },
        { status: 422 }
      )
    }

    const config = {
      ...DEFAULT_CONFIG,
      ...parsed.data,
      guardrails: {
        ...DEFAULT_CONFIG.guardrails,
        ...(parsed.data.guardrails ?? {}),
      },
      enabledHooks:
        parsed.data.enabledHooks && parsed.data.enabledHooks.length
          ? parsed.data.enabledHooks
          : DEFAULT_CONFIG.enabledHooks,
    }

    const cookieStore = await cookies()
    const supabase = await createServerClient(cookieStore)
    const { data: formRow, error: fetchError } = await supabase
      .from("forms")
      .select("agent_state")
      .eq("id", formId)
      .maybeSingle()

    if (fetchError) throw fetchError

    const agentState =
      (formRow?.agent_state as Record<string, unknown> | null) || {}
    const nextAgentState = {
      ...agentState,
      lifecycle_v1: config,
    }

    const { error: updateError } = await supabase
      .from("forms")
      .update({
        agent_state: nextAgentState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", formId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, config })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
