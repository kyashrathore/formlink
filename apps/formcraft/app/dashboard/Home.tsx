"use client"

import { analytics } from "@/app/lib/analytics"
import { APP_NAME } from "@/app/lib/config"
import { Database } from "@formlink/db"
import {
  CardTitle,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@formlink/ui"
import { format } from "date-fns"
import { motion } from "motion/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { startTransition, useCallback, useEffect, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import FormlinkLogo from "../components/FormlinkLogo"
import { AppInfo } from "../components/layout/app-info"
import UserMenu from "../components/layout/user-menu"
import { DashboardChat } from "./components/DashboardChat"
import { FormWithVersions } from "./types"

function formatDate(dateString?: string | null) {
  if (!dateString) return "N/A"
  const date = new Date(dateString)
  try {
    return format(date, "PP p")
  } catch {
    return "N/A"
  }
}

interface User {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
  [key: string]: unknown
}

export default function HomeWrapper({
  user,
  forms,
}: {
  user: User | null
  forms: FormWithVersions[]
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <Home forms={forms} user={user} />
    </SidebarProvider>
  )
}

interface HomeProps {
  forms: FormWithVersions[]
  user: User | null
}

function Home({ forms, user }: HomeProps) {
  const router = useRouter()
  const sidebar = useSidebar()
  const isSidebarExpanded = sidebar?.state === "expanded"
  const isLoggedIn = user !== null
  // Simplified - just track if we should navigate to forms page

  const [formIdForAgentPanel, setFormIdForAgentPanel] = useState<string | null>(
    null
  )

  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    // Create a new form ID when component mounts
    const newFormId = uuidv4()
    setFormIdForAgentPanel(newFormId)
  }, [])

  const handleStartFormCreation = useCallback(
    (message: string) => {
      if (!formIdForAgentPanel) {
        console.log("No formIdForAgentPanel available")
        return
      }

      console.log("Starting form creation with:", {
        message,
        formIdForAgentPanel,
        url: `/dashboard/forms/${formIdForAgentPanel}?initialPrompt=${encodeURIComponent(message)}`,
      })

      setIsNavigating(true)
      analytics.formCreationStarted("ai_chat")

      startTransition(() => {
        router.push(
          `/dashboard/forms/${formIdForAgentPanel}?initialPrompt=${encodeURIComponent(message)}`
        )
      })
    },
    [formIdForAgentPanel, router]
  )

  const userData = user
    ? ({
        ...user,
        profile_image: user.user_metadata?.avatar_url,
        display_name: user.user_metadata?.full_name,
      } as Database["public"]["Tables"]["users"]["Row"])
    : null

  return (
    <motion.div
      className="flex h-screen w-full flex-col"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex h-screen w-full flex-col">
        <div className="flex flex-grow">
          <Sidebar side="left" className="border-r" collapsible="icon">
            <div className="flex w-full items-center justify-start p-2">
              {isSidebarExpanded ? (
                <div className="flex w-full items-center justify-between gap-2">
                  <Link
                    prefetch={true}
                    href="/dashboard"
                    className="flex items-center text-xl font-medium tracking-tight lowercase"
                  >
                    <FormlinkLogo /> {APP_NAME}
                  </Link>
                  <SidebarTrigger />
                </div>
              ) : (
                <SidebarTrigger />
              )}
            </div>
            <SidebarHeader className="flex items-start justify-center p-4">
              {isSidebarExpanded && (
                <CardTitle className="text-md">Your Forms</CardTitle>
              )}
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu className="space-y-1 p-2">
                {forms.length > 0 ? (
                  forms.map((form) => (
                    <SidebarMenuItem key={form.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={false}
                        size="default"
                        tooltip={
                          form.published_version
                            ? form.published_version.title
                            : form.draft_version?.title || "Untitled Form"
                        }
                        className="h-12 py-2"
                      >
                        <Link
                          prefetch={true}
                          href={`/dashboard/forms/${form.id}`}
                          className="flex w-full items-center gap-2"
                        >
                          {" "}
                          {}
                          {isSidebarExpanded && (
                            <div className="flex flex-col">
                              <span className="leading-tight font-medium">
                                {form.published_version
                                  ? form.published_version.title
                                  : form.draft_version?.title ||
                                    "Untitled Form"}
                              </span>
                              <span className="text-xs leading-tight text-gray-500">
                                {form.published_version
                                  ? `Published: ${formatDate(form.published_version.published_at)}`
                                  : `Draft: ${formatDate(form.draft_version?.updated_at)}`}
                              </span>
                            </div>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                ) : (
                  <p className="p-2 text-sm text-gray-500">
                    {isSidebarExpanded ? "No forms yet." : ""}
                  </p>
                )}
              </SidebarMenu>
            </SidebarContent>
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
              <div className="flex items-center gap-4 p-2">
                {userData && <UserMenu user={userData} />}
              </div>
            )}
          </Sidebar>
          <SidebarInset>
            <DashboardChat
              onSubmit={handleStartFormCreation}
              isNavigating={isNavigating}
            />
          </SidebarInset>
        </div>
      </div>
    </motion.div>
  )
}
