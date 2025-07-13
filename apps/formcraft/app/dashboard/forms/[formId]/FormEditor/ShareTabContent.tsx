import { getFormFillerFBasePath } from "@/app/lib/config"
import { Button, Card, CodeBlock, CodeBlockCode,  ToggleGroup, ToggleGroupItem } from "@formlink/ui"
import { Copy } from "lucide-react"
import { useTheme } from "next-themes"
import React, { useState } from "react"
import { useFormPageContext } from "../formPageContext"
import CopiableLink from "./CopiableLink"
import { EmbedCodeParts, EmbedType, getEmbedCode } from "./utils"

const EMBED_TYPES: { type: EmbedType; label: string }[] = [
  { type: "popup", label: "Popup" },
  { type: "slider", label: "Slider" },
  { type: "modal", label: "Modal" },
  { type: "fullPage", label: "Full Page" },
  { type: "inline", label: "Inline" },
]

export default function ShareTabContent({
  formId,
  shortId,
}: {
  formId: string
  shortId?: string
}) {
  const { systemTheme, theme } = useTheme()
  const appliedTheme = theme === "system" ? systemTheme : theme
  const { embedType, setEmbedType } = useFormPageContext()
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle")

  const publicUrl = `${getFormFillerFBasePath()}/${shortId || formId}`
  const embedCodeParts: EmbedCodeParts = getEmbedCode(
    embedType,
    shortId || formId
  )

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCodeParts.element)
    setCopyState("copied")
    setTimeout(() => setCopyState("idle"), 1200)
  }

  return (
    <div className="h-[calc(100dvh-48px)] w-full overflow-y-auto px-2 pb-40">
      <div className="flex w-full flex-shrink-0 flex-col gap-8">
        <div>
          <CopiableLink
            value={publicUrl}
            label="Link"
            description="The public link of this form"
          />
          <CopiableLink
            className="mt-8"
            value={publicUrl + "?formlinkai_testmode=true"}
            label="Test Link"
            description="Use this link to test form, all responses will be saved in draft state."
          />
        </div>

        <div>
          <span className="font-semibold">Embed</span>
          <div className="text-muted-foreground mb-2 text-sm">
            Embed this form on your website
          </div>
          {}
          <ToggleGroup
            type="single"
            value={embedType}
            onValueChange={(value) => value && setEmbedType(value as EmbedType)}
            className="mb-4 w-full overflow-hidden border"
          >
            {EMBED_TYPES.map((et) => (
              <ToggleGroupItem
                className="min-w-15 text-xs"
                key={et.type}
                value={et.type}
              >
                {et.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Card className="flex flex-col gap-2 p-1">
            <div className="p-2">
              <CodeBlock className="m-0 text-sm">
                <CodeBlockCode
                  code={embedCodeParts.element}
                  language="html"
                  theme={appliedTheme}
                  className=""
                />
              </CodeBlock>
            </div>
            <Button
              variant="secondary"
              className="mt-2 flex w-full items-center gap-2 text-xs"
              onClick={handleCopy}
            >
              <Copy className="size-3" />
              {copyState === "copied"
                ? "Copied!"
                : `Copy ${EMBED_TYPES.find((e) => e.type === embedType)?.label} Embed Code`}
            </Button>
          </Card>
          <div className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
            {`Paste this code inside the  <body>  tag of your html`}
          </div>
          {embedCodeParts.script && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold">{`Required Script (add to <head> of your document)`}</div>
              <CodeBlock className="m-0 text-xs">
                <CodeBlockCode
                  code={embedCodeParts.script}
                  language="html"
                  theme={appliedTheme}
                  className=""
                />
              </CodeBlock>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
