"use server"

import { createServerClient, SupabaseClient } from "@formlink/db"
import { Form } from "@formlink/schema"
import { cookies } from "next/headers"

async function getFormSchemaById(
  formId: string,
  versionIdColumn: "current_published_version_id" | "current_draft_version_id",
  versionStatus: "published" | "draft",
  supabase: SupabaseClient
): Promise<Form | null> {
  const { data: formData, error: formError } = await supabase
    .from("forms")
    .select("current_published_version_id, current_draft_version_id")
    .eq("id", formId)
    .single()

  if (formError || !formData) {
    if (formError && formError.code !== "PGRST116") {
    }
    return null
  }

  const versionId = formData[versionIdColumn]

  if (!versionId) {
    return null
  }

  const { data: versionData, error: versionError } = await supabase
    .from("form_versions")
    .select("version_id, title, description, questions, settings")
    .eq("version_id", versionId)
    .eq("status", versionStatus)
    .single()

  if (versionError || !versionData) {
    if (versionError && versionError.code !== "PGRST116") {
    }
    return null
  }

  try {
    const v = versionData
    const formSchemaResult: Form = {
      id: formId,
      version_id: v.version_id,
      title: v.title,
      description: v.description,
      questions: v.questions,
      settings: v.settings,
      current_published_version_id: formData.current_published_version_id,
      current_draft_version_id: formData.current_draft_version_id,
    }
    return formSchemaResult
  } catch {
    return null
  }
}

export async function getForm(formId: string): Promise<Form | null> {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  try {
    let formSchema: Form | null = null

    formSchema = await getFormSchemaById(
      formId,
      "current_published_version_id",
      "published",
      supabase
    )
    if (!formSchema) {
      formSchema = await getFormSchemaById(
        formId,
        "current_draft_version_id",
        "draft",
        supabase
      )
    }

    if (!formSchema) {
      return null
    }

    return formSchema
  } catch {
    return null
  }
}
