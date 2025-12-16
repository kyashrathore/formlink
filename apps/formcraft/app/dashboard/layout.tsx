import { Header } from "@/app/components/layout/header"
import { createServerClient } from "@formlink/db"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { DashboardLayoutClient } from "./DashboardLayoutClient"
import { FormWithVersions } from "./types"

export const metadata: Metadata = {
  title: {
    default: "Dashboard | Formlink.ai",
    template: "%s | Formlink.ai",
  },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
    .order("created_at", { ascending: false })

  const formsWithVersions: FormWithVersions[] = formsWithVersionsData || []

  // Shared server header across all dashboard routes.
  // Body applies padding-top to clear the fixed header height.
  return (
    <div className="bg-background min-h-dvh">
      {/* Top fixed header (SSR) */}
      <Header className="z-[60]" />

      {/* Main area below header. */}
      <div className="h-[calc(100vh-var(--h-app-header,3.5rem))] pt-[var(--h-app-header,3.5rem)]">
        <DashboardLayoutClient forms={formsWithVersions} user={user}>
          {children}
        </DashboardLayoutClient>
      </div>
    </div>
  )
}
