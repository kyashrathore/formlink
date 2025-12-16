"use client"

import { Badge, Input } from "@formlink/ui"
import { formatDistanceToNow } from "date-fns"
import { AnimatePresence, motion } from "framer-motion"
import { Home, Palette, Plug } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { FormWithVersions } from "./types"

function formatRelative(dateString?: string | null) {
  if (!dateString) return "N/A"
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return "N/A"
  return formatDistanceToNow(date, { addSuffix: true })
}

interface DashboardLayoutClientProps {
  children: React.ReactNode
  forms: FormWithVersions[]
  user: any
}

export function DashboardLayoutClient({
  children,
  forms,
  user,
}: DashboardLayoutClientProps) {
  const pathname = usePathname()
  // Default to visible so it's there until cursor leaves
  const [isHovered, setIsHovered] = useState(true)
  const [query, setQuery] = useState("")
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    if (isImmersive) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(false)
      }, 300)
    }
  }

  // Immersive Mode: Floating on Forms pages to give max space
  const isImmersive = pathname.startsWith("/dashboard/forms/")
  const shouldShowSidebar = isImmersive ? isHovered : true

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

  const navItems = [
    {
      label: "Home",
      href: "/dashboard",
      icon: Home,
      isActive: pathname === "/dashboard",
    },
    {
      label: "Integrations",
      href: "/dashboard/integrations",
      icon: Plug,
      isActive: pathname.startsWith("/dashboard/integrations"),
    },
    {
      label: "Branding",
      href: "/dashboard/branding",
      icon: Palette,
      isActive: pathname.startsWith("/dashboard/branding"),
    },
  ]

  // Height needs to account for fixed header (h-14 / 3.5rem)
  const sidebarHeightClass = isImmersive
    ? "h-[calc(100vh-3.5rem)] top-14"
    : "h-[calc(100vh-3.5rem)]"

  return (
    <div
      className={`${isImmersive ? "relative" : "flex"} bg-background w-full`}
    >
      <AnimatePresence mode="wait">
        {shouldShowSidebar && (
          <motion.aside
            initial={
              isImmersive ? { x: -280, opacity: 0 } : { x: 0, opacity: 1 }
            }
            animate={{ x: 0, opacity: 1 }}
            exit={isImmersive ? { x: -280, opacity: 0 } : undefined}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={` ${isImmersive ? "fixed z-40 border-r shadow-xl" : "relative sticky top-0 border-r"} ${sidebarHeightClass} bg-background border-border flex w-[280px] shrink-0 flex-col overflow-hidden`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Header (Logo removed to avoid duplication with Global Header) */}
            {/* We add top padding/spacing instead */}
            <div className="pt-4" />

            {/* Main Nav */}
            <nav className="shrink-0 space-y-1 p-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    item.isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="bg-border/50 mx-4 my-2 h-px shrink-0" />

            {/* Forms Search & List */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="shrink-0 px-3 pb-2">
                <span className="text-muted-foreground mb-2 block px-1 text-xs font-semibold">
                  Your Forms
                </span>
                <Input
                  placeholder="Search forms..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
                {filteredForms.length > 0 ? (
                  filteredForms.map((form) => {
                    const isActive = pathname.includes(form.id)
                    return (
                      <Link
                        key={form.id}
                        prefetch={true}
                        href={`/dashboard/forms/${form.id}`}
                        className={`flex flex-col gap-1 rounded-lg p-2 transition-colors ${
                          isActive
                            ? "bg-accent/50 text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                      >
                        <span className="w-full truncate text-sm leading-none font-medium">
                          {form.published_version
                            ? form.published_version.title
                            : form.draft_version?.title || "Untitled Form"}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] opacity-80">
                          <Badge
                            variant={
                              form.published_version ? "default" : "secondary"
                            }
                            className="h-3.5 px-1 py-0 text-[9px] uppercase"
                          >
                            {form.published_version ? "Published" : "Draft"}
                          </Badge>
                          <span>
                            {form.published_version
                              ? formatRelative(
                                  form.published_version.published_at
                                )
                              : formatRelative(form.draft_version?.updated_at)}
                          </span>
                        </div>
                      </Link>
                    )
                  })
                ) : (
                  <p className="text-muted-foreground mt-4 p-2 text-center text-xs">
                    {query ? "No matching forms." : "No forms yet."}
                  </p>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Logo Trigger (Invisible Overlay over the Header Logo area) */}
      {/* We keep this persistent so we can detect leaving the area (to the right) even when sidebar is open. */}
      {isImmersive && (
        <div
          className="fixed top-0 left-0 z-[70] h-14 w-[240px] cursor-pointer bg-transparent"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => setIsHovered(true)}
          title="Hover to open sidebar"
        />
      )}

      {/* Main Content */}
      <main
        className={`min-h-screen flex-1 overflow-y-auto ${isImmersive ? "w-full" : ""}`}
      >
        {children}
      </main>

      {/* Mobile Overlay for Immersive */}
      {isImmersive && isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setIsHovered(false)}
        />
      )}
    </div>
  )
}
