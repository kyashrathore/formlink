"use client"

import { Form } from "@formlink/schema"
import { Tabs, TabsList, TabsTrigger } from "@formlink/ui"
import { PublishMode } from "../publish/PublishTab"
import DirectLinkSettings from "../publish/settings/DirectLinkSettings"
import EmbedSettings from "../publish/settings/EmbedSettings"

interface PublishCardProps {
  form: Form
  formId: string
  shortId?: string
  publishMode: PublishMode
  setPublishMode: (mode: PublishMode) => void
}

export default function PublishCard({
  form,
  formId,
  shortId,
  publishMode,
  setPublishMode,
}: PublishCardProps) {
  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="mb-4 font-semibold">Publish & Share</h2>

      <Tabs
        value={publishMode}
        onValueChange={(v) => setPublishMode(v as PublishMode)}
        className="flex max-h-screen w-full flex-1 flex-col overflow-hidden"
      >
        <TabsList className="mb-4 grid w-full shrink-0 grid-cols-2">
          <TabsTrigger value="direct">Direct Link</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto pr-1">
          {publishMode === "direct" ? (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <DirectLinkSettings
                form={form}
                formId={formId}
                shortId={shortId}
              />
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <EmbedSettings formId={formId} shortId={shortId} />
            </div>
          )}
        </div>
      </Tabs>
    </div>
  )
}
