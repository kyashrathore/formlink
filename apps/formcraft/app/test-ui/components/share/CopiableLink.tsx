import { Button, Card } from "@formlink/ui"
import { Copy } from "lucide-react"
import React, { useState } from "react"

interface CopiableLinkProps {
  value: string
  label?: string
  description?: string
  className?: string
  inputClassName?: string
  buttonClassName?: string
}

export function CopiableLink({
  value,
  label,
  description,
  className = "",
  inputClassName = "",
  buttonClassName = "",
}: CopiableLinkProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle")

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopyState("copied")
    setTimeout(() => setCopyState("idle"), 1200)
  }

  return (
    <div className={className}>
      {label && <span className="font-semibold">{label}</span>}
      {description && (
        <div className="text-muted-foreground mb-2 text-sm">{description}</div>
      )}
      <Card className="flex flex-col gap-2 p-1">
        <div className="p-3">
          <input
            className={
              "w-full bg-transparent font-mono text-xs outline-none " +
              inputClassName
            }
            value={value}
            readOnly
            style={{ fontFamily: "monospace" }}
          />
        </div>
        <Button
          variant="secondary"
          className={
            "mt-2 flex w-full items-center gap-2 text-xs " + buttonClassName
          }
          onClick={handleCopy}
        >
          <Copy className="size-3" />
          {copyState === "copied" ? "Copied!" : "Copy Link"}
        </Button>
      </Card>
    </div>
  )
}

export default CopiableLink
