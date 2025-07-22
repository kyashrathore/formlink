import React from "react";
import { FormSchema, Form } from "@formlink/schema";
import PreviewPageClient from "./PreviewPageClient";
import { createServerClient } from "@formlink/db";
import { notFound } from "next/navigation";

async function getFormSchemaById(
  formIdOrShortId: string,
): Promise<Form | null> {
  const supabase = await createServerClient(null, "service");

  // Try to find by short_id first, then by full id
  let formData, formError;

  // First try short_id
  const shortIdResult = await supabase
    .from("forms")
    .select("id, current_published_version_id, current_draft_version_id")
    .eq("short_id", formIdOrShortId)
    .single();

  if (shortIdResult.data) {
    formData = shortIdResult.data;
    formError = shortIdResult.error;
  } else {
    // If not found by short_id, try by full id
    const fullIdResult = await supabase
      .from("forms")
      .select("id, current_published_version_id, current_draft_version_id")
      .eq("id", formIdOrShortId)
      .single();

    formData = fullIdResult.data;
    formError = fullIdResult.error;
  }

  if (formError || !formData) {
    if (formError && formError.code !== "PGRST116") {
      console.error(
        `Supabase error fetching form ${formIdOrShortId}:`,
        formError.message,
      );
    }
    return null;
  }

  let versionId = formData.current_published_version_id;
  let versionStatus: "published" | "draft" = "published";

  if (!versionId) {
    versionId = formData.current_draft_version_id;
    versionStatus = "draft";
  }

  if (!versionId) {
    return null;
  }

  const { data: versionData, error: versionError } = await supabase
    .from("form_versions")
    .select("version_id, title, description, questions, settings")
    .eq("version_id", versionId)
    .eq("status", versionStatus)
    .single();

  if (versionError || !versionData) {
    if (versionError && versionError.code !== "PGRST116") {
      console.error(
        `Supabase error fetching ${versionStatus} version ${versionId} for form ${formIdOrShortId}:`,
        versionError.message,
      );
    }
    return null;
  }

  try {
    const formSchemaResult = {
      id: formData.id,
      shortId: formIdOrShortId,
      version_id: versionData.version_id,
      title: versionData.title,
      description: versionData.description,
      questions: Array.isArray(versionData.questions)
        ? versionData.questions
        : [],
      settings:
        typeof versionData.settings === "object" &&
        versionData.settings !== null
          ? versionData.settings
          : {},
      current_published_version_id: formData.current_published_version_id,
      current_draft_version_id: formData.current_draft_version_id,
    };

    const validationResult = FormSchema.safeParse(formSchemaResult);
    if (!validationResult.success) {
      console.error(
        `Server Schema Validation Error for form ${formData.id} (version ${versionData.version_id}):`,
        validationResult.error.errors,
      );

      return null;
    }

    return validationResult.data;
  } catch (castError) {
    console.error(
      `Error constructing form schema object for version ${versionId}:`,
      castError,
    );
    return null;
  }
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const awaitedParams = await params;
  const formId = awaitedParams?.formId;

  if (!formId) {
    notFound();
  }

  const formSchema = await getFormSchemaById(formId);

  if (!formSchema) {
    notFound();
  }

  // Always set test mode for preview
  const isTestSubmission = true;

  return (
    <PreviewPageClient
      formSchema={formSchema}
      isTestSubmission={isTestSubmission}
    />
  );
}
