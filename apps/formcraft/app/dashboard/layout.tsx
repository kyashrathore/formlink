import DashboardLayoutClient from "./DashboardLayoutClient"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div
      id="dashboard-root"
      className="h-dvh overflow-hidden overscroll-contain"
    >
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </div>
  )
}
