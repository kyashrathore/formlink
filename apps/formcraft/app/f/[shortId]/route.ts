import { createServerClient } from "@formlink/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: { shortId: string } }
) {
  const shortId = params.shortId
  if (!shortId) {
    return new Response("Form not found", { status: 404 })
  }

  const supabase = await createServerClient(null, "service")
  const { data, error } = await supabase
    .from("forms")
    .select("live_url, preview_url")
    .eq("short_id", shortId)
    .single()

  if (error || !data) {
    return new Response("Form not found", { status: 404 })
  }

  const targetUrl = data.live_url || data.preview_url

  if (!targetUrl) {
    return new Response("Preview not available yet", { status: 404 })
  }

  const response = NextResponse.redirect(targetUrl, { status: 302 })
  if (!data.live_url) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }
  return response
}
