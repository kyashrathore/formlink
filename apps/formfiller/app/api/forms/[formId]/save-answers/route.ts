import { NextRequest, NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { createServerClient, SupabaseClient, Database } from "@formlink/db";
import { saveAllFormAnswers, saveIndividualFormAnswer } from "./utils";
import type {
  SaveAnswersRequestBody,
  FormSettings,
  WebhookPayload,
  QuestionResponse,
} from "@/lib/types";
import logger from "@/app/lib/logger";
import { runSubmissionJob } from "@/app/lib/intel/submission-job";

async function handleIntegration(
  supabase: SupabaseClient<Database>,
  versionId: string,
  originalBody: SaveAnswersRequestBody,
) {
  const { data: form, error: formError } = await supabase
    .from("form_versions")
    .select("settings")
    .eq("version_id", versionId)
    .single();

  if (formError) {
    logger.error("[save-answers] Error fetching form_versions for webhook", {
      error: formError.message,
    });
    return; // Early return on error
  }

  if (
    form &&
    typeof form.settings === "object" &&
    form.settings !== null &&
    !Array.isArray(form.settings)
  ) {
    const settings = form.settings as FormSettings;

    if (
      settings.integrations &&
      typeof settings.integrations.webhookUrl === "string" &&
      settings.integrations.webhookUrl
    ) {
      const webhookUrl = settings.integrations.webhookUrl;

      // Construct the new standardized webhook payload
      const webhookPayload: WebhookPayload = {
        submissionId: originalBody.submissionId,
        versionId: originalBody.formVersionId,
        submissionStatus: originalBody.submissionStatus,
        testmode: originalBody.testmode,
        answers: originalBody.allResponses
          ? Object.entries(originalBody.allResponses).map(([q_id, answer]) => ({
              q_id,
              answer: answer as QuestionResponse,
              is_additional_field: false,
            }))
          : [],
      };

      // Remove undefined keys from the payload to keep it clean
      Object.keys(webhookPayload).forEach((key) => {
        const typedKey = key as keyof WebhookPayload;
        if (webhookPayload[typedKey] === undefined) {
          delete webhookPayload[typedKey];
        }
      });

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(webhookPayload), // Use the new standardized payload
        });
        if (!response.ok) {
          logger.error("[save-answers] Webhook call failed", {
            url: webhookUrl,
            status: response.status,
          });
        }
      } catch (e) {
        logger.error("[save-answers] Webhook call exception", {
          url: webhookUrl,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SaveAnswersRequestBody;
    const {
      submissionId,
      formVersionId: versionId,
      isPartial,
      submissionStatus,
      testmode,
    } = body;
    if (!submissionId || !versionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const supabase = await createServerClient(null, "service");

    if (isPartial) {
      const { questionId, answerValue } = body;
      if (!questionId || typeof answerValue === "undefined") {
        return NextResponse.json(
          { error: "Missing questionId or answerValue for partial save" },
          { status: 400 },
        );
      }
      await saveIndividualFormAnswer(
        supabase,
        submissionId,
        versionId,
        questionId,
        answerValue,
        (submissionStatus || "in_progress") === "completed",
        !!testmode,
      );
      return NextResponse.json({ success: true, partial: true });
    } else {
      const { allResponses } = body;

      await saveAllFormAnswers(
        supabase,
        submissionId,
        versionId,
        allResponses || {}, // Default to empty object
        (submissionStatus ||
          (allResponses && Object.keys(allResponses).length > 0
            ? "completed"
            : "in_progress")) === "completed",
        !!testmode,
      );

      const resolvedStatus =
        submissionStatus ||
        (allResponses && Object.keys(allResponses).length > 0
          ? "completed"
          : "in_progress");

      after(() =>
        runSubmissionJob({
          submissionId,
          formVersionId: versionId,
          trigger: resolvedStatus === "completed" ? "completed" : "partial",
        }).catch((error: unknown) => {
          logger.error("[Lifecycle] submission job failed", {
            submissionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }),
      );

      // Invalidate summary caches for this form via tag
      try {
        const { data: fv } = await supabase
          .from("form_versions")
          .select("form_id")
          .eq("version_id", versionId)
          .single();
        const formId = (fv as any)?.form_id as string | undefined;
        if (formId) revalidateTag(`ri:summary:${formId}`, "max");
      } catch {}

      // Only call the integration if there are actual responses
      if (allResponses && Object.keys(allResponses).length > 0) {
        await handleIntegration(supabase, versionId, body);
      }
      // email creator
      return NextResponse.json({ success: true, partial: false });
    }
  } catch (error) {
    logger.error("[save-answers] API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
