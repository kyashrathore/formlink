import { cn } from "@/app/lib"
import React from "react"

interface SectionHeaderProps {
  title: string
  subtitle?: string
  className?: string
}

export const SectionHeader = React.memo(function SectionHeader({
  title,
  subtitle,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-[60px] text-center", className)}>
      <h2 className="mb-4 text-4xl font-bold">{title}</h2>
      {subtitle && <p className="text-muted-foreground text-lg">{subtitle}</p>}
    </div>
  )
})
