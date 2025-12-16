import GlobalIntegrations from "@/app/dashboard/integrations/GlobalIntegrations"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function IntegrationsPage() {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto p-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Manage your connected accounts and services.
          </p>
        </div>

        <GlobalIntegrations userId={user.id} />
      </div>
    </div>
  )
}
