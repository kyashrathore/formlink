import { DynamicBreadcrumb } from "@/app/components/layout/DynamicBreadcrumb"
import { cn } from "@/app/lib"
import { createServerClient, Database } from "@formlink/db"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@formlink/ui"
import { cookies } from "next/headers"
import Link from "next/link"
import React from "react"
import { APP_NAME } from "../../lib/config"
import FormlinkLogo from "../FormlinkLogo"
import { AppInfo } from "./app-info"
import UserMenu from "./user-menu"

export async function Header({ className }: { className?: string }) {
  const cookieStore = await cookies()
  const supabase = await createServerClient(cookieStore)
  const { data } = await supabase.auth.getUser()
  const isLoggedIn = data.user !== null

  let userProfile = null
  if (data.user) {
    const { data: userProfileData } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user?.id)
      .single()
    userProfile = userProfileData
  }

  const userData = {
    ...userProfile,
    profile_image: data.user?.user_metadata.avatar_url,
    display_name: data.user?.user_metadata.name,
  } as Database["public"]["Tables"]["users"]["Row"]

  return (
    <header
      className={cn(
        "h-app-header bg-background fixed top-0 right-0 left-0 z-50 border-b",
        className
      )}
    >
      <div className="h-app-header top-app-header bg-background pointer-events-none absolute left-0 z-50 mx-auto w-full to-transparent backdrop-blur-xl [-webkit-mask-image:linear-gradient(to_bottom,black,transparent)] lg:hidden"></div>
      <div className="bg-background relative mx-auto flex h-full items-center justify-between px-8 sm:px-4 lg:bg-transparent lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <Link
              href="/dashboard"
              className="flex items-center text-xl font-medium tracking-tight lowercase"
            >
              <FormlinkLogo /> {APP_NAME}
            </Link>
          </div>
        </div>
        {!isLoggedIn ? (
          <div className="flex items-center gap-4">
            <AppInfo />
            <Link
              href="/auth"
              className="font-base text-muted-foreground hover:text-foreground text-base transition-colors"
            >
              Login
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <UserMenu user={userData} />
          </div>
        )}
      </div>
    </header>
  )
}
