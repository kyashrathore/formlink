import { runSubmissionJob } from "@/app/lib/intel/submission-job"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const schema = z.object({
  submissionId: z.string().uuid(),
  formVersionId: z.string().uuid().nullable().optional(),
  trigger: z.enum(["completed", "partial", "manual"]).default("completed"),
})

const TOKEN = process.env.FORMCRAFT_LIFECYCLE_TOKEN || ""

export async function POST(req: NextRequest) {
  if (TOKEN) {
    const header = req.headers.get("x-internal-token")
    if (header !== TOKEN) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }
  }

  const payload = await req.json().catch(() => null)
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", issues: parsed.error.issues },
      { status: 422 }
    )
  }

  try {
    await runSubmissionJob({
      submissionId: parsed.data.submissionId,
      formVersionId: parsed.data.formVersionId,
      trigger: parsed.data.trigger,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to run job",
      },
      { status: 500 }
    )
  }
}
