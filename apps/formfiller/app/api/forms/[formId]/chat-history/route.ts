import { createServerClient } from "@formlink/db";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  try {
    const { formId } = await params;

    if (!formId) {
      return NextResponse.json(
        { error: "Missing formId in route params" },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const submissionId = url.searchParams.get("submissionId");

    if (!submissionId) {
      return NextResponse.json(
        { error: "Missing submissionId query parameter" },
        { status: 400 },
      );
    }

    // Service client for server-side queries
    const supabase = await createServerClient(null, "service");

    // Initialize submission status variables
    let submissionStatus = null;
    let completedAt = null;

    // Ensure the submission belongs to the form (best-effort; ignore if not available)
    // We store form_version_id; for compatibility, allow either version_id or id in formSchema
    // This is a soft check - do not block if the join isn't resolvable in current schema.
    try {
      const { data: submissionRec, error: submissionErr } = await supabase
        .from("form_submissions")
        .select("form_version_id, status, completed_at")
        .eq("submission_id", submissionId)
        .maybeSingle();

      if (submissionErr) {
        // Proceed (non-blocking); log minimal message
        console.error(
          "[chat-history] Failed to verify submission ownership:",
          submissionErr.message,
        );
      } else if (submissionRec) {
        // Store submission status for the response
        submissionStatus = submissionRec.status;
        completedAt = submissionRec.completed_at;
      }
    } catch (verifyErr) {
      console.error(
        "[chat-history] Ownership verify exception:",
        verifyErr instanceof Error ? verifyErr.message : verifyErr,
      );
    }

    // Fetch messages for this submission
    const { data: rows, error } = await supabase
      .from("submission_messages")
      .select("id, role, content, created_at")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "[chat-history] Error fetching submission_messages:",
        error.message,
      );
      return NextResponse.json(
        { error: "Failed to fetch chat history" },
        { status: 500 },
      );
    }

    const messages =
      rows?.map((r: any) => {
        // Return the stored UIMessage as-is if it's a properly formatted UIMessage with parts
        if (r.content && typeof r.content === "object") {
          // Check if it's a UIMessage with parts array (new format)
          if (r.content.parts && Array.isArray(r.content.parts)) {
            return r.content;
          }
          // Check if it's a legacy format with role (old format)
          if (r.content.role) {
            return r.content;
          }
        }

        // Fallback: convert legacy content to parts format
        return {
          id: String(r.id),
          role: r.role === "assistant" ? "assistant" : "user",
          parts: [{ text: String(r.content || ""), type: "text" }],
          createdAt: r.created_at ?? undefined,
        };
      }) ?? [];

    // Also return aggregated responses from form_answers to hydrate UI state on reload
    const { data: answersRows, error: answersError } = await supabase
      .from("form_answers")
      .select("question_id, answer_value")
      .eq("submission_id", submissionId);

    if (answersError) {
      console.error(
        "[chat-history] Error fetching form_answers:",
        answersError.message,
      );
    }

    const responses: Record<string, unknown> = (answersRows ?? []).reduce(
      (acc: Record<string, unknown>, r: any) => {
        acc[r.question_id] = r.answer_value;
        return acc;
      },
      {},
    );

    return NextResponse.json(
      {
        formId,
        submissionId,
        messages,
        responses,
        count: messages.length,
        submissionStatus,
        completedAt,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      "[chat-history] Unexpected error:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
