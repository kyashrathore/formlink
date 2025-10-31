"use client"

import dynamic from "next/dynamic"
import { usePanelState } from "../hooks/usePanelState"
import { useFormEditorStore } from "../stores/useFormEditorStore"

// Code-split heavy tabs so only the active one loads.
// Keep Form tab (default) eager; others lazy via dynamic imports to reduce initial JS parse/exec.
const FormTabContent = dynamic(
  () => import("@/app/dashboard/forms/[formId]/components/FormTabContent"),
  { ssr: false }
)
const PreviewTabContent = dynamic(
  () => import("@/app/dashboard/forms/[formId]/components/PreviewTabContent"),
  {
    ssr: false,
    loading: () => <div className="p-4" aria-busy="true" />,
  }
)
const ResponsesTabContent = dynamic(
  () => import("@/app/dashboard/forms/[formId]/components/ResponsesTabContent"),
  {
    ssr: false,
    loading: () => <div className="p-4" aria-busy="true" />,
  }
)
const SettingsTabContent = dynamic(
  () => import("@/app/dashboard/forms/[formId]/components/SettingsTabContent"),
  {
    ssr: false,
    loading: () => <div className="p-4" aria-busy="true" />,
  }
)
const ShareTabContent = dynamic(
  () => import("@/app/dashboard/forms/[formId]/components/ShareTabContent"),
  {
    ssr: false,
    loading: () => <div className="p-4" aria-busy="true" />,
  }
)

const CODEGEN_PREVIEW =
  process.env.NEXT_PUBLIC_CODEGEN_PREVIEW_UI === "true" ||
  process.env.CODEGEN_PREVIEW_UI === "true"

interface TabContentManagerProps {
  formId: string
  shadcnCSSData?: {
    cssText: string
    version: number
  }
  onShadcnApplied?: (result: {
    success: boolean
    error?: string
    appliedRootVariables: string[]
    appliedDarkVariables: string[]
    warnings: string[]
  }) => void
}

export default function TabContentManager({
  formId,
  shadcnCSSData,
  onShadcnApplied,
}: TabContentManagerProps) {
  const { activeMainTab } = usePanelState()
  const shortId = useFormEditorStore((s) => s.form?.short_id)

  const renderContent = () => {
    switch (activeMainTab) {
      case "form":
        if (CODEGEN_PREVIEW) {
          return (
            <PreviewTabContent
              formId={formId}
              shadcnCSSData={shadcnCSSData}
              onShadcnApplied={onShadcnApplied}
            />
          )
        }
        return <FormTabContent />
      case "preview":
        return (
          <PreviewTabContent
            formId={formId}
            shadcnCSSData={shadcnCSSData}
            onShadcnApplied={onShadcnApplied}
          />
        )
      case "responses":
        return <ResponsesTabContent />
      case "share":
        return (
          <ShareTabContent
            formId={formId}
            shortId={shortId || undefined}
            shortIdLoading={false}
            shortIdError={null}
          />
        )
      case "settings":
        return <SettingsTabContent formId={formId} />
      default:
        return <FormTabContent />
    }
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div className="animate-in fade-in-0 h-full transition-all duration-300 ease-in-out">
        <div
          key={activeMainTab}
          className="animate-in fade-in-0 slide-in-from-right-1 h-full duration-300"
        >
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
