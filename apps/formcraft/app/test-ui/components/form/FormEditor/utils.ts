import { getFormFillerFBasePath } from "@/app/lib/config"

export type EmbedType = "popup" | "slider" | "modal" | "fullPage" | "inline"

export type EmbedCodeParts = {
  element: string
  script: string | null
}

export function getEmbedCode(type: EmbedType, formId: string): EmbedCodeParts {
  const basePath = getFormFillerFBasePath()
  const embedScriptUrl = `${basePath}/embed/v1.js`
  const popupScriptUrl = `${basePath}/embed/popup/v1.js`
  const url = `${basePath}/${formId}`

  switch (type) {
    case "popup":
      return {
        element: `<script
  src="${popupScriptUrl}"
  data-formfiller-url="${url}"
  data-formfiller-popup-bg-color="black"
  data-formfiller-popup-icon-color="#ffffff"
  data-formfiller-popup-icon-type="default"
  async
>
</script>`,
        script: null,
      }
    case "slider":
      return {
        element: `<div
  id="formfiller-launch-button"
  data-href="${url}"
  data-type="slider"
  side="right">
  <button>Try Me</button>
</div>`,
        script: `<script src="${embedScriptUrl}">
  // add this to html head
</script>`,
      }
    case "modal":
      return {
        element: `<div
  id="formfiller-launch-button"
  data-href="${url}"
  data-type="modal">
  <button>Try Me</button>
</div>`,
        script: `<script src="${embedScriptUrl}">
  // add this to html head
</script>`,
      }
    case "fullPage":
      return {
        element: `<iframe
  style="height:100vh;width:100%;border:none;"
  width="100%"
  height="100%"
  src="${url}"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
>
</iframe>`,
        script: null,
      }
    case "inline":
    default:
      return {
        element: `<iframe
  style="height:90%;width:90%;border:none;"
  width="90%"
  height="90%"
  src="${url}"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
>
</iframe>`,
        script: null,
      }
  }
}
