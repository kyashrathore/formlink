import { createServerClient } from "@formlink/db";
import { v4 as uuidv4 } from "uuid";
import { trackServerEvent } from "../utils";

const CHAT_ASSIST_DEBUG_ENABLED = process.env.NODE_ENV !== "production";

export class SubmissionService {
  static async ensureSubmissionExists(
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

  static async hydrateEffectiveResponses(
    submissionId: string,
    clientResponses: Record<string, any>,
  ): Promise<Record<string, any>> {
    try {
      const supabase = await createServerClient(null, "service");
      const { data: serverAns } = await supabase
        .from("form_answers")
        .select("question_id, answer_value")
        .eq("submission_id", submissionId);

      const serverMap =
        (serverAns ?? []).reduce((acc: Record<string, any>, r: any) => {
          acc[r.question_id] = r.answer_value;
          return acc;
        }, {}) || {};

      // Server wins on conflicts
      return { ...(clientResponses || {}), ...serverMap };
    } catch (err) {
      return clientResponses || {};
    }
  }

  static async saveSubmissionMessage(
    submissionId: string,
    message: any,
    userId?: string,
  ): Promise<void> {
    try {
      const supabase = await createServerClient(null, "service");
      const { error } = await supabase.from("submission_messages").insert({
        submission_id: submissionId,
        role: message.role,
        content: message,
        user_id: userId || null,
      });

      if (error) {
        console.error("[chat-assist] Error saving message:", error.message);
        trackServerEvent("message.save.error", { role: message.role });
      }
    } catch (err) {
      console.error(
        "[chat-assist] Exception while saving message:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  static async preSaveAnswer(
    submissionId: string,
    questionId: string,
    value: any,
  ): Promise<boolean> {
    try {
      const supabase = await createServerClient(null, "service");

      await supabase.from("form_answers").upsert(
        {
          submission_id: submissionId,
          question_id: questionId,
          answer_value: value,
        },
        { onConflict: "submission_id,question_id" },
      );

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
}
