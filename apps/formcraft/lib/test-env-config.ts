import { getFormFillerPreviewBasePath } from "@/app/lib/config"

export function testEnvironmentConfiguration() {
  const previewBasePath = getFormFillerPreviewBasePath()

  const formFillerBaseUrl = process.env.NEXT_PUBLIC_FORMFILLER_BASE_URL

  const nodeEnv = process.env.NODE_ENV

  const expectedDevelopmentUrl = "http://localhost:3001"
  const expectedProductionUrl = "https://formlink.ai"

  let configurationValid = false

  if (nodeEnv === "development") {
    if (formFillerBaseUrl) {
      const expected = `${formFillerBaseUrl}/preview`
      configurationValid = previewBasePath === expected
    } else {
      configurationValid = previewBasePath === expectedDevelopmentUrl
    }
  } else {
    if (formFillerBaseUrl) {
      const expected = `${formFillerBaseUrl}/preview`
      configurationValid = previewBasePath === expected
    } else {
      configurationValid = previewBasePath === expectedProductionUrl
    }
  }

  return {
    previewBasePath,
    formFillerBaseUrl,
    nodeEnv,
    isConfigured: Boolean(formFillerBaseUrl),
    configurationValid,
  }
}
