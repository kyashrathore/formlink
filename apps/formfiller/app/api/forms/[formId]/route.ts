import { NextResponse } from "next/server";
import { z } from "zod";
import { FormSchema } from "@formlink/schema";
import { createServerClient } from "@formlink/db";

async function getFormSchemaById(
  formId: string,
  versionIdColumn: "current_published_version_id" | "current_draft_version_id",
  versionStatus: "published" | "draft",
): Promise<z.infer<typeof FormSchema> | null> {
  const supabase = await createServerClient(null, "service");

  const { data: formData, error: formError } = await supabase
    .from("forms")
    .select("current_published_version_id, current_draft_version_id")
    .eq("id", formId)
    .single();

  if (formError || !formData) {
    if (formError && formError.code !== "PGRST116") {
      console.error(
        `Supabase error fetching form ${formId}:`,
        formError.message,
      );
    }
    return null;
  }

  const versionId = formData[versionIdColumn];

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
        `Supabase error fetching ${versionStatus} version ${versionId} for form ${formId}:`,
        versionError.message,
      );
    }
    return null;
  }

  try {
    const formSchemaResult: z.infer<typeof FormSchema> = {
      id: formId,
      version_id: versionData.version_id,
      title: versionData.title,
      description: versionData.description,
      questions: versionData.questions,
      settings: versionData.settings,
    };
    return formSchemaResult;
  } catch (castError) {
    console.error(
      `Error constructing form schema object for version ${versionId}:`,
      castError,
    );
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  const formId = (await params).formId;

  if (!formId) {
    return NextResponse.json({ error: "Form ID is required" }, { status: 400 });
  }

  try {
    let formSchema: z.infer<typeof FormSchema> | null = null;

    // Try published first, then draft if not found
    formSchema = await getFormSchemaById(
      formId,
      "current_published_version_id",
      "published",
    );
    if (!formSchema) {
      formSchema = await getFormSchemaById(
        formId,
        "current_draft_version_id",
        "draft",
      );
    }

    if (!formSchema) {
      return NextResponse.json(
        { error: `Form or requested version (published/draft) not found` },
        { status: 404 },
      );
    }

    const validationResult = FormSchema.safeParse(formSchema);
    if (!validationResult.success) {
      console.error(
        `API Schema Validation Error for form ${formId} (version ${formSchema.version_id}):`,
        validationResult.error.errors,
      );

      return NextResponse.json(
        { error: "Invalid form schema data retrieved from server" },
        { status: 500 },
      );
    }

    // Default: return full schema
    return NextResponse.json(validationResult.data);
  } catch (error) {
    console.error(`API Error fetching form schema for ${formId}:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
