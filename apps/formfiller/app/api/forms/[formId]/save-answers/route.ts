import { NextRequest, NextResponse } from "next/server";
import { createServerClient, SupabaseClient, Database } from "@formlink/db";
import { saveAllFormAnswers, saveIndividualFormAnswer } from "./utils";
import type {
  SaveAnswersRequestBody,
  FormSettings,
  WebhookPayload,
  QuestionResponse,
} from "@/lib/types";

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
    console.error(
      `[API] Error fetching form_versions for webhook: ${formError.message}`,
    );
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
          console.error(
            `[API] Webhook call to ${webhookUrl} failed with status ${response.status}: ${await response.text()}`,
          );
        }
      } catch (e) {
        console.error(
          `[API] Webhook call to ${webhookUrl} threw an error: ${e instanceof Error ? e.message : String(e)}`,
        );
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
        submissionStatus || "in_progress",
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
        submissionStatus ||
          (allResponses && Object.keys(allResponses).length > 0
            ? "completed"
            : "in_progress"),
        !!testmode,
      );

      // Only call the integration if there are actual responses
      if (allResponses && Object.keys(allResponses).length > 0) {
        await handleIntegration(supabase, versionId, body);
      }
      // email creator
      return NextResponse.json({ success: true, partial: false });
    }
  } catch (error) {
    console.error("Error in save-answers API:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
