import { v4 as uuidv4 } from "uuid";
import { createServerClient } from "@formlink/db";
import { trackServerEvent } from "../utils";

export async function ensureSubmissionExists(
  submissionId: string | null | undefined,
  formSchema: any,
  userId?: string | null | undefined,
  isTestSubmission = false,
  ip = "unknown",
  userAgent = "unknown",
): Promise<string> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let activeSubmissionId = submissionId;
  if (!activeSubmissionId || !uuidRegex.test(activeSubmissionId)) {
    if (activeSubmissionId && !uuidRegex.test(activeSubmissionId)) {
      // TODO(logging): previously warned on invalid submission ID format; logs removed.
    }
    activeSubmissionId = uuidv4();
  }

  const supabase = await createServerClient(null, "service");
  const { error: submissionError } = await supabase
    .from("form_submissions")
    .upsert(
      {
        submission_id: activeSubmissionId,
        form_version_id: formSchema.version_id || formSchema.id,
        status: "in_progress",
        user_id: userId,
        testmode: isTestSubmission,
        metadata: {
          ip_address: ip,
          user_agent: userAgent,
          started_at: new Date().toISOString(),
        },
      },
      { onConflict: "submission_id" },
    );

  if (submissionError) {
    console.error(
      "[chat-assist] Failed to create/update submission:",
      submissionError.message,
    );
    trackServerEvent("submission.upsert.error", {
      error: submissionError.message,
    });
    throw new Error("Failed to initialize form submission");
  }

  return activeSubmissionId;
}

export async function saveSubmissionMessage(
  submissionId: string,
  message: any,
  userId?: string,
): Promise<void> {
  try {
    const supabase = await createServerClient(null, "service");
    const { data, error } = await supabase
      .from("submission_messages")
      .insert({
        submission_id: submissionId,
        role: message.role,
        content: message,
        user_id: userId || null,
      })
      .select();

    if (error) {
      console.error("[chat-assist] Error saving message:", error.message);
      trackServerEvent("message.save.error", { role: message.role });
      throw new Error(
        `Failed to save ${message.role} message: ${error.message}`,
      );
    }
  } catch (err) {
    console.error(
      "[chat-assist] Exception while saving message:",
      err instanceof Error ? err.message : err,
    );
    trackServerEvent("message.save.exception", {
      role: message?.role || "unknown",
    });
    throw err;
  }
}

export async function hydrateEffectiveResponses(
  submissionId: string,
  clientResponses: Record<string, any>,
): Promise<Record<string, any>> {
  try {
    const supabase = await createServerClient(null, "service");
    const { data: serverAns, error: serverAnsErr } = await supabase
      .from("form_answers")
      .select("question_id, answer_value")
      .eq("submission_id", submissionId);

    const serverMap =
      (serverAns ?? []).reduce((acc: Record<string, any>, r: any) => {
        acc[r.question_id] = r.answer_value;
        return acc;
      }, {}) || {};

    // Merge client responses with server answers, server wins on conflicts
    const effectiveResponses = { ...(clientResponses || {}), ...serverMap };

    if (serverAnsErr) {
      // TODO(logging): previously warned on failed server answers fetch; logs removed.
    }

    return effectiveResponses;
  } catch (err) {
    return clientResponses || {};
  }
}

export async function preSaveAnswer(
  submissionId: string,
  questionId: string,
  value: any,
): Promise<boolean> {
  try {
    const supabase = await createServerClient(null, "service");

    // Persist answer
    await supabase.from("form_answers").upsert(
      {
        submission_id: submissionId,
        question_id: questionId,
        answer_value: value,
      },
      { onConflict: "submission_id,question_id" },
    );

    // Touch submission updated time
    await supabase
      .from("form_submissions")
      .update({ last_updated_at: new Date().toISOString() })
      .eq("submission_id", submissionId);

    return true;
  } catch (e) {
    console.error(
      "[chat-assist] Pre-save failed:",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

export async function upsertAnswerBatch(
  submissionId: string,
  entries: Array<{ questionId: string; value: any }>,
): Promise<boolean> {
  if (entries.length === 0) {
    return true;
  }

  try {
    const supabase = await createServerClient(null, "service");
    const payload = entries.map((entry) => ({
      submission_id: submissionId,
      question_id: entry.questionId,
      answer_value: entry.value,
    }));

    const { error: upsertError } = await supabase
      .from("form_answers")
      .upsert(payload, {
        onConflict: "submission_id,question_id",
      });

    if (upsertError) {
      console.error("[chat-assist] bulk upsert failed:", upsertError.message);
      return false;
    }

    const { error: touchError } = await supabase
      .from("form_submissions")
      .update({ last_updated_at: new Date().toISOString() })
      .eq("submission_id", submissionId);

    if (touchError) {
      console.error(
        "[chat-assist] failed to mark submission updated:",
        touchError.message,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "[chat-assist] exception bulk upserting answers:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

export async function markSubmissionCompleted(
  submissionId: string,
  metadata: Record<string, any> = {},
): Promise<boolean> {
  try {
    const supabase = await createServerClient(null, "service");

    const { error } = await supabase
      .from("form_submissions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata,
      })
      .eq("submission_id", submissionId);

    if (error) {
      console.error(
        "[chat-assist] failed to mark submission completed:",
        error.message,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "[chat-assist] exception marking submission completed:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
