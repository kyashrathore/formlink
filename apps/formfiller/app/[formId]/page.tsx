import React from "react";
import { FormSchema, Form } from "@formlink/schema";
import FormPageClient from "@/app/[formId]/FormPageClient";
import { createServerClient } from "@formlink/db";
import { notFound } from "next/navigation";

async function getFormSchemaById(shortId: string): Promise<Form | null> {
  const supabase = await createServerClient(null, "service");

  const { data: formData, error: formError } = await supabase
    .from("forms")
    .select("id, current_published_version_id, current_draft_version_id")
    .eq("short_id", shortId)
    .single();

  if (formError || !formData) {
    if (formError && formError.code !== "PGRST116") {
      console.error(
        `Supabase error fetching form ${shortId}:`,
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
        `Supabase error fetching ${versionStatus} version ${versionId} for form ${shortId}:`,
        versionError.message,
      );
    }
    return null;
  }

  try {
    const formSchemaResult = {
      id: formData.id,
      shortId: shortId,
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

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const awaitedParams = await params;
  const awaitedSearchParams = await searchParams;
  const formId = awaitedParams?.formId;
  if (!formId) {
    notFound();
  }

  const formSchema = await getFormSchemaById(formId);

  if (!formSchema) {
    notFound();
  }

  // Read the query param as boolean
  const isTestSubmission =
    typeof awaitedSearchParams?.formlinkai_testmode === "string"
      ? awaitedSearchParams.formlinkai_testmode === "true"
      : Array.isArray(awaitedSearchParams?.formlinkai_testmode)
        ? awaitedSearchParams.formlinkai_testmode[0] === "true"
        : false;

  // Extract query parameters specified in formSchema.settings.additionalFields.queryParamater
  const queryDataForForm: Record<string, string | number | boolean> = {};
  const queryParamList = Array.isArray(
    formSchema?.settings?.additionalFields?.queryParamater,
  )
    ? formSchema.settings.additionalFields.queryParamater
    : [];
  if (queryParamList.length > 0) {
    for (const param of queryParamList) {
      if (typeof param === "string" && param in awaitedSearchParams) {
        const value = awaitedSearchParams[param];
        // If the value is an array, take the first value
        queryDataForForm[param] = Array.isArray(value) ? value[0] : value;
      }
    }
  }

  return (
    <FormPageClient
      formSchema={formSchema}
      isTestSubmission={isTestSubmission}
      queryDataForForm={queryDataForForm}
      searchParams={awaitedSearchParams}
    />
  );
}
