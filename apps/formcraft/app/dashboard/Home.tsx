"use client"

import { analytics } from "@/app/lib/analytics"
import { APP_NAME } from "@/app/lib/config"
import {
  Badge,
  CardTitle,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@formlink/ui"
import { formatDistanceToNow } from "date-fns"
import { motion } from "motion/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { v4 as uuidv4 } from "uuid"
import FormlinkLogo from "../components/FormlinkLogo"
import { DashboardChat } from "./components/DashboardChat"
import { FormWithVersions } from "./types"

function formatRelative(dateString?: string | null) {
  if (!dateString) return "N/A"
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return "N/A"
  return formatDistanceToNow(date, { addSuffix: true })
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
  // Client-side search for forms
  const [query, setQuery] = useState("")
  const onQueryChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => setQuery(e.target.value),
    []
  )
  const filteredForms = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return forms
    return forms.filter((f) => {
      const t = (
        f.published_version?.title ||
        f.draft_version?.title ||
        "Untitled Form"
      ).toLowerCase()
      return t.includes(q)
    })
  }, [forms, query])

  useEffect(() => {
    // Create a new form ID when component mounts
    const newFormId = uuidv4()
    setFormIdForAgentPanel(newFormId)
  }, [])

  const handleStartFormCreation = useCallback(
    (message: string, model: string) => {
      if (!formIdForAgentPanel) return

      setIsNavigating(true)
      analytics.formCreationStarted("ai_chat")
      startTransition(() => {
        const url = `/dashboard/forms/${formIdForAgentPanel}?initialPrompt=${encodeURIComponent(
          message
        )}&model=${encodeURIComponent(model)}`
        router.push(url)
      })
    },
    [formIdForAgentPanel, router]
  )

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
            <SidebarHeader>
              {isSidebarExpanded && (
                <>
                  <CardTitle className="text-md">Your Forms</CardTitle>
                  <SidebarInput
                    placeholder="Search forms..."
                    value={query}
                    onChange={onQueryChange}
                  />
                </>
              )}
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu className="space-y-1 p-1">
                {(filteredForms.length > 0 ? filteredForms : []).map((form) => (
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
                      className="hover:bg-secondary h-auto p-0"
                    >
                      <Link
                        prefetch={true}
                        href={`/dashboard/forms/${form.id}`}
                        aria-label={
                          form.published_version
                            ? form.published_version.title
                            : form.draft_version?.title || "Untitled Form"
                        }
                        className="group/item flex w-full items-start gap-3 rounded-md px-3 py-1"
                      >
                        {isSidebarExpanded && (
                          <div className="flex w-full flex-col">
                            <span className="group-hover/item:text-primary text-sm leading-tight font-medium break-words transition-colors">
                              {form.published_version
                                ? form.published_version.title
                                : form.draft_version?.title || "Untitled Form"}
                            </span>
                            <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                              <Badge
                                variant={
                                  form.published_version
                                    ? "default"
                                    : "secondary"
                                }
                                className="shrink-0 text-[10px] uppercase"
                              >
                                {form.published_version ? "Published" : "Draft"}
                              </Badge>
                              <span>
                                {form.published_version
                                  ? `Published ${formatRelative(form.published_version.published_at)}`
                                  : `Updated ${formatRelative(form.draft_version?.updated_at)}`}
                              </span>
                            </div>
                          </div>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {filteredForms.length === 0 && (
                  <p className="p-2 text-sm text-gray-500">
                    {isSidebarExpanded
                      ? query
                        ? "No matching forms."
                        : "No forms yet."
                      : ""}
                  </p>
                )}
              </SidebarMenu>
            </SidebarContent>
            {/* Footer area intentionally empty: shared Header now provides user menu/login. */}
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
