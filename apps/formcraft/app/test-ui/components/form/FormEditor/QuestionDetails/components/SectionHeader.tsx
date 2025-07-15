import React from "react"
import { SectionHeaderProps } from "../types"

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon: Icon,
  title,
}) => {
  return (
    <div className="mb-2 flex items-center text-xs font-semibold">
      <Icon className="mr-2 size-4" />
      <p>{title}</p>
    </div>
  )
}
