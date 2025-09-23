import {
  getOrComputeSummary,
  type SummaryRequest,
} from "@/app/lib/ri/summaries"
import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SummaryRequest
    if (!body?.formId) {
      return NextResponse.json({ error: "Missing formId" }, { status: 400 })
    }
    const res = await getOrComputeSummary(body)
    // Tag-based cache coordination per form
    revalidateTag?.(`ri:summary:${body.formId}`)
    return NextResponse.json(res)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 })
  }
}
