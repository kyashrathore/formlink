import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function BrandingPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Brand Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure global brand settings for your forms.
          </p>
        </div>

        <div className="bg-muted/50 flex items-center justify-center rounded-lg border border-dashed p-12">
          <p className="text-muted-foreground">
            Global branding settings coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}
