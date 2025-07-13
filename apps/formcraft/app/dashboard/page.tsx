import { Header } from "@/app/components/layout/header"
import HomePageWrapper from "@/app/dashboard/Home"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { FormWithVersions } from "./types"

export const dynamic = 'force-dynamic'

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }
  const { data: formsWithVersionsData, error: formsError } = await supabase
    .from("forms")
    .select(
      `
      id,
      current_published_version_id,
      current_draft_version_id,
      published_version:form_versions!current_published_version_id(
        version_id, title, description, questions, status, updated_at, published_at, archived_at
      ),
      draft_version:form_versions!current_draft_version_id(
        version_id, title, description, questions, status, updated_at, published_at, archived_at
      )
      `
    )

  if (formsError) {
    console.error("Error loading forms with versions:", formsError)
    return (
      <div className="flex items-center justify-center">
        Error loading forms: {formsError.message}
      </div>
    )
  }

  const formsWithVersions: FormWithVersions[] = formsWithVersionsData || []

  return (
    <div className="bg-background @container/mainview relative flex h-full w-full">
      <main className="@container relative h-dvh w-0 flex-shrink flex-grow">
        <HomePageWrapper user={user} forms={formsWithVersions} />
      </main>
    </div>
  )
}
