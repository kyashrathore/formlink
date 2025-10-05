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
      console.warn(
        `[chat-assist] Invalid submission ID format, generating new: ${activeSubmissionId}`,
      );
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
    console.error("Failed to create/update submission:", submissionError);
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
      console.error("Error saving message to submission_messages:", error);
      trackServerEvent("message.save.error", { role: message.role });
      throw new Error(
        `Failed to save ${message.role} message: ${error.message}`,
      );
    }
  } catch (err) {
    console.error("Exception while saving message:", err);
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
      console.warn(
        "[chat-assist] Failed to fetch server answers:",
        serverAnsErr,
      );
    }

    return effectiveResponses;
  } catch (err) {
    console.warn("[chat-assist] Exception while fetching server answers:", err);
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
    console.warn("[chat-assist] Pre-save failed:", e);
    return false;
  }
}
