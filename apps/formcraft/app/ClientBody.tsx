"use client"

export default function ClientBody({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-screen antialiased">{children}</div>
}
