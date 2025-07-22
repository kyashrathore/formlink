"use client"

import DesignPanel from "./form/DesignPanel"

interface DesignTabContentProps {
  formId: string
  onShadcnCSSApply?: (cssText: string) => void
  shadcnStatus?: {
    loading: boolean
    error?: string
    success?: boolean
    appliedRootVariables?: string[]
    appliedDarkVariables?: string[]
    warnings?: string[]
  }
}

export default function DesignTabContent({
  formId,
  onShadcnCSSApply,
  shadcnStatus,
}: DesignTabContentProps) {
  return (
    <div className="bg-card h-full overflow-y-auto">
      <div>
        <DesignPanel
          formId={formId}
          onShadcnCSSApply={onShadcnCSSApply}
          shadcnStatus={shadcnStatus}
        />
      </div>
    </div>
  )
}
