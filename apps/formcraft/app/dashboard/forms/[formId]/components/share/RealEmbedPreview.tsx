import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import { EmbedCodeParts, EmbedType, getEmbedCode } from "../../lib/embed/utils"
import { useFormPageContext } from "../../stores/formPageContext"
import DevicePreviewFrame, { DeviceMode } from "../form/DevicePreviewFrame"
import { FormMode } from "../form/FormModeControls"
import PreviewHeader from "../form/PreviewHeader"

function getHtmlPreview(
  embedType: string,
  formId: string,
  isLight: boolean,
  formMode: FormMode
) {
  const embedCodeParts: EmbedCodeParts = getEmbedCode(
    embedType as EmbedType,
    formId,
    formMode
  )
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

export default function RealEmbedPreview({
  shortId,
  formMode,
  setFormMode,
}: {
  shortId: string
  formMode: FormMode
  setFormMode: (mode: FormMode) => void
}) {
  const { embedType } = useFormPageContext()
  const { theme } = useTheme()
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop")

  const isLight = theme === "light"
  const htmlPreview = getHtmlPreview(embedType, shortId, isLight, formMode)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(htmlPreview)
    doc.close()
  }, [embedType, shortId, htmlPreview, formMode]) // Added htmlPreview dep

  return (
    <div className="flex h-full w-full flex-col">
      <PreviewHeader
        formMode={formMode}
        onFormModeChange={setFormMode}
        deviceMode={deviceMode}
        onDeviceModeChange={setDeviceMode}
      />
      <div className="bg-muted/5 flex-1">
        <DevicePreviewFrame
          deviceMode={deviceMode}
          onDeviceModeChange={setDeviceMode}
        >
          <iframe
            ref={iframeRef}
            title="Embed Preview"
            className="bg-muted h-full w-full"
            // Removed border/rounded from iframe as Frame handles it
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </DevicePreviewFrame>
      </div>
    </div>
  )
}
