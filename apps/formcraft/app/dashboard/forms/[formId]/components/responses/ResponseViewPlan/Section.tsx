"use client"

import { cn } from "@formlink/ui/lib/utils"
import React from "react"

export function Section({
  title,
  icon,
  children,
  className,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="text-foreground/80 flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </div>
  )
}
