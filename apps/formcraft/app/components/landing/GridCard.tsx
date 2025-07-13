import { cn } from "@/app/lib"
import React from "react"

interface GridCardProps {
  children: React.ReactNode
  className?: string
}

export const GridCard = React.memo(function GridCard({
  children,
  className,
}: GridCardProps) {
  return (
    <div
      className={cn(
        "bg-card relative p-10",
        "transition-all duration-200",
        className
      )}
    >
      {children}
    </div>
  )
})
