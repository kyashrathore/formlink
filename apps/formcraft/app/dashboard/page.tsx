import HomePageWrapper from "@/app/dashboard/Home"
import { createServerClient } from "@formlink/db"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  // Forms data is now fetched in layout.tsx for the sidebar.
  // Home page content (Chat) doesn't strictly need forms list unless for context,
  // but currently simplified HomeWrapper doesn't use it.
  // Passing empty array for compatibility if needed.

  return (
    <div className="bg-background @container/mainview relative flex h-full w-full">
      <main className="@container relative h-full w-full flex-shrink flex-grow">
        <HomePageWrapper user={user as any} forms={[]} />
      </main>
    </div>
  )
}
