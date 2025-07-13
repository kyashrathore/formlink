import { cn } from "@/lib/utils"
import { Option } from "@formlink/schema"
import { Badge } from "@formlink/ui"
import { X } from "lucide-react"
import React from "react"
import { DeletableBadgeProps } from "../types"

export const DeletableBadge: React.FC<DeletableBadgeProps> = ({
  items,
  onDelete,
  variant = "outline",
  className,
  isOption = false,
}) => {
  if (!items || items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, index) => {
        const label = isOption ? (item as Option).label : (item as string)

        return (
          <Badge
            key={index}
            variant={variant}
            className={cn(
              "group relative flex items-center justify-between rounded-full py-1",
              isOption ? "pr-6" : "px-2",
              className
            )}
          >
            {label}
            <button
              type="button"
              onClick={() => onDelete(index)}
              aria-label={`Remove ${label}`}
              className={
                isOption ? "flex w-full items-center justify-between" : ""
              }
            >
              <X className="size-3" />
            </button>
          </Badge>
        )
      })}
    </div>
  )
}
