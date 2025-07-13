import { cn } from "@/app/lib/utils"
import { createServerClient, User } from "@formlink/db"
import { Button, Skeleton } from "@formlink/ui"
import { AlertCircle, FileQuestion } from "lucide-react"
import { cookies } from "next/headers"
import { unstable_ViewTransition as ViewTransition } from "react"
import FormPageClient from "./FormPageClient"

const FormEditorError: React.FC<{ error: string }> = ({ error }) => (
  <div className="text-destructive flex h-screen flex-col items-center justify-center p-4 text-center">
    <AlertCircle className="mb-4 h-12 w-12" />
    <h2 className="mb-2 text-xl font-semibold">Error Loading Form Data</h2>
    <p className="text-sm">{error}</p>

    <Button variant="outline" className="mt-4" onClick={() => {}}>
      Try Again
    </Button>
  </div>
)

const FormEditorNoData: React.FC = () => (
  <div className="text-muted-foreground flex h-screen flex-col items-center justify-center p-4 text-center">
    <FileQuestion className="mb-4 h-12 w-12" />
    <p>No form data loaded or available.</p>

    <Button variant="outline" className="mt-4" onClick={() => {}}>
      Load Example Data
    </Button>
  </div>
)

export default async function FormPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params

  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: formData, error: formError } = await supabase
    .from("forms")
    .select(
      "id, current_published_version_id, current_draft_version_id, short_id"
    )
    .eq("id", formId)
    .single()

  // If formData is not found, it might be a new client-side generated formId.
  // We'll pass null for initialDbForm and let FormPageClient handle it.
  // Only show hard errors if formError indicates a real DB issue other than not found.
  if (formError && formError.code !== "PGRST116") {
    // PGRST116: "Fetched result not found"
    console.error("[FormPage Server] Error fetching form metadata:", formError)
    return (
      <FormEditorError
        error={
          formError.message || "Failed to load form data due to a server error."
        }
      />
    )
  }

  if (formData) {
    // Existing form found, proceed to fetch version data
    let versionId = formData.current_draft_version_id
    // let versionStatus: "draft" | "published" = "draft" // Not directly used for now

    if (!versionId) {
      versionId = formData.current_published_version_id
      // if (versionId) {
      //   versionStatus = "published"
      // }
    }

    if (!versionId) {
      console.error(
        "[FormPage Server] No draft or published version ID found for existing form:",
        formId
      )
      // This is an error for an existing form
      return <FormEditorNoData />
    }

    const { data: versionData, error: versionError } = await supabase
      .from("form_versions")
      .select("version_id, title, description, questions, settings")
      .eq("version_id", versionId)
      .single()

    if (versionError || !versionData) {
      console.error(
        "[FormPage Server] Error fetching form version data for existing form:",
        versionError
      )
      return (
        <FormEditorError
          error={versionError?.message || "Failed to load form version."}
        />
      )
    }

    const formSchemaCandidate = {
      id: formData.id,
      version_id: versionData.version_id,
      title: typeof versionData.title === "string" ? versionData.title : "",
      description:
        typeof versionData.description === "string"
          ? versionData.description
          : "",
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
      short_id: formData.short_id, // Make sure short_id is passed
    }

    const { FormSchema } = await import("@formlink/schema")
    const validationResult = FormSchema.safeParse(formSchemaCandidate)

    if (!validationResult.success) {
      console.error(
        "[FormPage Server] Schema validation error for existing form:",
        validationResult.error.errors
      )
      return (
        <FormEditorError
          error={
            "Server Schema Validation Error: " +
            validationResult.error.errors
              .map((e: any) => `${e.path.join(".")}: ${e.message}`)
              .join("; ")
          }
        />
      )
    }
    return (
      <ViewTransition>
        <FormPageClient
          formIdFromUrl={formId}
          initialDbForm={validationResult.data}
          user={user as User | null}
        />
      </ViewTransition>
    )
  } else {
    // formData is null, and no critical db error. This is a new client-side formId.
    return (
      <FormPageClient
        formIdFromUrl={formId}
        initialDbForm={null}
        user={user as User | null}
      />
    )
  }
}
