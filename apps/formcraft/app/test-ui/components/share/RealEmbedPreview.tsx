import { useTheme } from "next-themes"
import React, { useEffect, useRef } from "react"
import { EmbedCodeParts, EmbedType, getEmbedCode } from "../../lib/embed/utils"
import { useFormPageContext } from "../../stores/formPageContext"

function useHtmlPreview(embedType: string, formId: string) {
  const embedCodeParts: EmbedCodeParts = getEmbedCode(
    embedType as EmbedType,
    formId
  )
  const { theme } = useTheme()
  const isLight = theme === "light"
  return `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
      }

      button {
        border-radius: 24px;
        padding: 8px 12px;
        outline: none;
        border: 1px solid oklch(.92 0 0);
      }

      body.dark {
        background: var(--muted);
      }

      body.dark button {
        background: var(--secondary);
        color: white;
      }

      :root {
        --muted: oklch(.23 0 0);
        --secondary: oklch(0.25 0 0);
        --border: oklch(.92 0 0);
      }
    </style>
    ${embedCodeParts.script ? embedCodeParts.script : ""}
  </head>
  <body class="${isLight ? "" : "dark"}"> ${embedCodeParts.element} </body>
</html>
  `
}

export default function RealEmbedPreview({ shortId }: { shortId: string }) {
  const { embedType } = useFormPageContext()
  const htmlPreview = useHtmlPreview(embedType, shortId)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(htmlPreview)
    doc.close()
  }, [embedType, shortId])

  return (
    <div className="bg-muted flex h-[calc(100dvh-104px)] flex-1 items-center justify-center rounded-xl border">
      <div className="flex h-full w-full items-center justify-center">
        <iframe
          ref={iframeRef}
          title="Embed Preview"
          className="bg-muted h-full w-full rounded-xl border"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </div>
  )
}
