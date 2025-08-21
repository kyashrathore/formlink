import React from "react";
import { FormSchema, Form } from "@formlink/schema";
import FormPageClient from "@/app/[formId]/FormPageClient";
import { createServerClient } from "@formlink/db";
import { notFound } from "next/navigation";

// Transform legacy string-based question types to new discriminated union format
function transformLegacyQuestionType(legacyQuestion: any): any {
  const { type, questionType, ...rest } = legacyQuestion;

  // Use questionType if it exists, otherwise fallback to type
  const legacyTypeValue = questionType || type;

  // If type is already an object, return as-is
  if (typeof legacyTypeValue === "object" && legacyTypeValue !== null) {
    return { ...rest, type: legacyTypeValue };
  }

  // Transform string-based types to discriminated union format
  let newType: any;

  switch (legacyTypeValue) {
    case "text":
      // For text questions, check if there's a display.inputType to use as format
      const inputType = legacyQuestion.display?.inputType;
      const format =
        inputType &&
        [
          "text",
          "email",
          "url",
          "tel",
          "number",
          "password",
          "country",
          "textarea",
        ].includes(inputType)
          ? inputType
          : "text";
      newType = { name: "text", format };
      break;
    case "email":
    case "url":
    case "tel":
    case "number":
    case "password":
    case "country":
      newType = { name: "text", format: legacyTypeValue };
      break;
    case "textarea":
      newType = { name: "text", format: "textarea" };
      break;
    case "singleChoice":
      const singleChoiceDisplay =
        legacyQuestion.display?.inputType === "dropdown" ? "dropdown" : "radio";
      newType = {
        name: "singleChoice",
        display: singleChoiceDisplay,
        options: legacyQuestion.options || [],
      };
      break;
    case "multipleChoice":
      const multipleChoiceDisplay =
        legacyQuestion.display?.inputType === "multiSelectDropdown"
          ? "multiSelectDropdown"
          : "checkbox";
      newType = {
        name: "multipleChoice",
        display: multipleChoiceDisplay,
        options: legacyQuestion.options || [],
      };
      break;
    case "rating":
      newType = {
        name: "rating",
        config: {
          min: legacyQuestion.min || 1,
          max: legacyQuestion.max || 5,
          step: legacyQuestion.step || 1,
          minLabel: legacyQuestion.minLabel,
          maxLabel: legacyQuestion.maxLabel,
        },
      };
      break;
    case "date":
      newType = { name: "date", format: "date" };
      break;
    case "dateRange":
      newType = { name: "date", format: "dateRange" };
      break;
    case "ranking":
      newType = { name: "ranking", options: legacyQuestion.options || [] };
      break;
    case "fileUpload":
      newType = { name: "fileUpload" };
      break;
    case "address":
      newType = { name: "address" };
      break;
    case "linearScale":
      newType = {
        name: "linearScale",
        config: {
          start: legacyQuestion.start || 0,
          end: legacyQuestion.end || 10,
          step: legacyQuestion.step || 1,
          startLabel: legacyQuestion.startLabel,
          endLabel: legacyQuestion.endLabel,
        },
      };
      break;
    case "likertScale":
      newType = {
        name: "likertScale",
        options: legacyQuestion.options || [],
      };
      break;
    default:
      // Fallback to text for unknown types
      newType = { name: "text", format: "text" };
      break;
  }

  return {
    ...rest,
    type: newType,
    // Ensure required fields exist
    submissionBehavior: legacyQuestion.submissionBehavior || "manualAnswer",
  };
}

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
    const rawQuestions = Array.isArray(versionData.questions)
      ? versionData.questions
      : [];

    // Transform legacy questions to new schema format
    const transformedQuestions = rawQuestions.map(transformLegacyQuestionType);

    const formSchemaResult = {
      id: formData.id,
      short_id: formIdOrShortId,
      version_id: versionData.version_id,
      title: versionData.title,
      description: versionData.description,
      questions: transformedQuestions,
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
        JSON.stringify(validationResult.error.errors, null, 2),
      );
      console.error(
        "Form data being validated:",
        JSON.stringify(formSchemaResult, null, 2),
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
        if (value !== undefined) {
          const resolvedValue = Array.isArray(value) ? value[0] : value;
          if (resolvedValue !== undefined) {
            queryDataForForm[param] = resolvedValue;
          }
        }
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
