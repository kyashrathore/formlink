"use client"

import {
  EmbedCodeParts,
  EmbedType,
  getEmbedCode,
} from "@/app/dashboard/forms/[formId]/lib/embed/utils"
import { useFormPageContext } from "@/app/dashboard/forms/[formId]/stores/formPageContext"
import {
  Button,
  Card,
  CodeBlock,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formlink/ui"
import { Copy } from "lucide-react"
import { useState } from "react"

interface EmbedSettingsProps {
  formId: string
  shortId?: string
}

const EMBED_TYPES: { type: EmbedType; label: string }[] = [
  { type: "popup", label: "Popup Button" },
  { type: "slider", label: "Slider / Side Tab" },
  { type: "modal", label: "Modal" },
  { type: "fullPage", label: "Full Page" },
  { type: "inline", label: "Inline Embed" },
]

export default function EmbedSettings({ formId, shortId }: EmbedSettingsProps) {
  const { embedType, setEmbedType } = useFormPageContext()
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle")

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
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Embed Type</Label>
        <Select
          value={embedType}
          onValueChange={(v) => setEmbedType(v as EmbedType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMBED_TYPES.map((et) => (
              <SelectItem key={et.type} value={et.type}>
                {et.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          The preview on the right will update automatically.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Embed Code</Label>
        <Card className="bg-muted/50 flex flex-col gap-2 p-1">
          <div className="overflow-x-auto p-2">
            <CodeBlock
              code={embedCodeParts.element}
              language="html"
              className="m-0 border-0 text-xs shadow-none"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-1 flex w-full items-center gap-2 text-xs"
            onClick={handleCopy}
          >
            <Copy className="size-3" />
            {copyState === "copied" ? "Copied!" : "Copy Code"}
          </Button>
        </Card>
      </div>

      {embedCodeParts.script && (
        <div className="space-y-3">
          <Label className="text-xs">
            Required Script (add to &lt;head&gt;)
          </Label>
          <Card className="bg-muted/50 overflow-x-auto p-2">
            <CodeBlock
              code={embedCodeParts.script}
              language="html"
              className="m-0 border-0 text-xs shadow-none"
            />
          </Card>
        </div>
      )}
    </div>
  )
}
