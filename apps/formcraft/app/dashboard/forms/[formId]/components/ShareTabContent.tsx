"use client"

import RealEmbedPreview from "./share/RealEmbedPreview"
import ShareTabContent from "./share/ShareTabContent"

interface ShareTabContentWrapperProps {
  formId: string
  shortId?: string
  shortIdLoading?: boolean
  shortIdError?: string | null
}

export default function ShareTabContentWrapper({
  formId,
  shortId,
  shortIdLoading,
  shortIdError,
}: ShareTabContentWrapperProps) {
  return (
    <div className="bg-background flex h-full">
      {/* Left Panel - Share Controls */}
      <div className="border-border bg-background w-[500px] max-w-[600px] min-w-[500px] border-r">
        <ShareTabContent formId={formId} shortId={shortId} />
      </div>

      {/* Right Panel - Embed Preview */}
      <div className="bg-background flex-1">
        {shortId || formId ? (
          <RealEmbedPreview shortId={shortId || formId} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="space-y-4 text-center">
              <h3 className="text-foreground text-lg font-semibold">
                Preview Not Available
              </h3>
              <p className="text-muted-foreground mx-auto max-w-xs text-sm">
                Please create a form to generate embed preview.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
