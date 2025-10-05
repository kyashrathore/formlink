import { Header } from "@/app/components/layout/header"
import type { Metadata } from "next"

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
  // Shared server header across all dashboard routes.
  // Body applies padding-top to clear the fixed header height.
  return (
    <div className="bg-background min-h-dvh">
      {/* Top fixed header (SSR) */}
      <Header className="z-[60]" />

      {/* Main area below header. h-app-header is the fixed header height. */}
      {/* TODO(formcraft): unify header height token (CSS var or theme) and reuse here. */}
      <div className="pt-[var(--h-app-header,3.5rem)]">{children}</div>
    </div>
  )
}
