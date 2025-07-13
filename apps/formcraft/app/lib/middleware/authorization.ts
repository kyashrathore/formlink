import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403
  ) {
    super(message)
    this.name = "AuthorizationError"
  }
}

interface FormOwnership {
  isOwner: boolean
  isPublic: boolean
  formExists: boolean
}

export async function verifyUserOwnsForm(
  formId: string,
  userId: string,
  isGuest: boolean = false
): Promise<FormOwnership> {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  const { data: form, error } = await supabase
    .from("forms")
    .select("user_id, current_published_version_id")
    .eq("id", formId)
    .single()

  if (error || !form) {
    return {
      isOwner: false,
      isPublic: false,
      formExists: false,
    }
  }

  // Check if user owns the form
  const isOwner = form.user_id === userId

  // Check if form is published (has a published version)
  const isPublic = !!form.current_published_version_id

  return {
    isOwner,
    isPublic,
    formExists: true,
  }
}

export async function verifyUserOwnsSubmission(
  submissionId: string,
  userId: string
): Promise<boolean> {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  const { data: submission, error } = await supabase
    .from("form_submissions")
    .select("user_id")
    .eq("submission_id", submissionId)
    .single()

  if (error || !submission) {
    return false
  }

  return submission.user_id === userId
}

export async function verifySubmissionBelongsToForm(
  submissionId: string,
  formVersionId: string
): Promise<boolean> {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  const { data: submission, error } = await supabase
    .from("form_submissions")
    .select("form_version_id")
    .eq("submission_id", submissionId)
    .single()

  if (error || !submission) {
    return false
  }

  return submission.form_version_id === formVersionId
}

export async function verifyUserCanAccessFormVersion(
  versionId: string,
  userId: string
): Promise<boolean> {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  const { data: version, error } = await supabase
    .from("form_versions")
    .select("form_id, status")
    .eq("version_id", versionId)
    .single()

  if (error || !version) {
    return false
  }

  // If version is published, anyone can access
  if (version.status === "published") {
    return true
  }

  // Otherwise, check form ownership
  const ownership = await verifyUserOwnsForm(version.form_id, userId)
  return ownership.isOwner
}

// Guest user specific checks
export async function verifyGuestUserLimits(
  userId: string
): Promise<{ withinLimits: boolean; reason?: string }> {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  // Check form count
  const { count: formCount } = await supabase
    .from("forms")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)

  if (formCount && formCount >= 5) {
    return {
      withinLimits: false,
      reason: "Guest users can create a maximum of 5 forms",
    }
  }

  // Check total submission count across all forms
  const { data: forms } = await supabase
    .from("forms")
    .select("id")
    .eq("user_id", userId)

  if (forms && forms.length > 0) {
    const formIds = forms.map((f) => f.id)
    const { count: submissionCount } = await supabase
      .from("form_submissions")
      .select("*", { count: "exact", head: true })
      .in("form_version_id", formIds)

    if (submissionCount && submissionCount >= 100) {
      return {
        withinLimits: false,
        reason: "Guest users can receive a maximum of 100 form submissions",
      }
    }
  }

  return { withinLimits: true }
}
