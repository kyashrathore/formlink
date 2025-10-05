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
    <div className={cn("mt-4 mb-2 space-y-2", className)}>
      <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </div>
  )
}
