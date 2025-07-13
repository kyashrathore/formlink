import { NextRequest, NextResponse } from "next/server";
import { createServerClient, SupabaseClient } from "@formlink/db";
import { saveAllFormAnswers, saveIndividualFormAnswer } from "./utils";

async function handleIntegration(
  supabase: SupabaseClient<any, "public", any>, // Adjust SupabaseClient type as needed
  versionId: string,
  originalBody: any, // Renamed for clarity, consider defining a more specific type
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
    const settings = form.settings as {
      integrations?: { webhookUrl?: string };
    };

    if (
      settings.integrations &&
      typeof settings.integrations.webhookUrl === "string" &&
      settings.integrations.webhookUrl
    ) {
      const webhookUrl = settings.integrations.webhookUrl;

      // Construct the new standardized webhook payload
      const webhookPayload: {
        submissionId: string;
        versionId: string;
        submissionStatus?: string;
        testmode?: boolean;
        answers: Array<{
          q_id: string;
          answer: any;
          is_additional_field: boolean;
        }>;
      } = {
        submissionId: originalBody.submissionId,
        versionId: originalBody.versionId,
        submissionStatus: originalBody.submissionStatus,
        testmode: originalBody.testmode,
        answers: originalBody.allResponses
          ? Object.entries(originalBody.allResponses).map(([q_id, answer]) => ({
              q_id,
              answer,
              is_additional_field: false,
            }))
          : [],
      };

      // Remove undefined keys from the payload to keep it clean
      Object.keys(webhookPayload).forEach((key) => {
        if ((webhookPayload as any)[key] === undefined) {
          delete (webhookPayload as any)[key];
        }
      });

      console.log(
        `[API] Sending standardized webhook for submissionId ${webhookPayload.submissionId} to ${webhookUrl}`,
      );
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
        } else {
          console.log(`[API] Webhook successfully sent to ${webhookUrl}`);
        }
      } catch (e: any) {
        console.error(
          `[API] Webhook call to ${webhookUrl} threw an error: ${e.message}`,
        );
      }
    } else {
      console.log(
        `[API] Webhook URL not configured or invalid for form version ${versionId}`,
      );
    }
  } else if (form) {
    console.log(
      `[API] Form settings are not a valid object for form version ${versionId}, skipping webhook.`,
    );
  } else {
    console.log(
      `[API] No form data found for version ${versionId}, skipping webhook.`,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
  } catch (error: any) {
    console.error("Error in save-answers API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
