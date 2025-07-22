/**
 * Test utility to verify environment configuration for preview mode
 */

import { getFormFillerPreviewBasePath } from "../app/lib/config"

export function testEnvironmentConfiguration() {
  // Test FormFiller base URL configuration
  const previewBasePath = getFormFillerPreviewBasePath()

  // Test environment variables
  const formFillerBaseUrl = process.env.NEXT_PUBLIC_FORMFILLER_BASE_URL

  const nodeEnv = process.env.NODE_ENV

  // Validate configuration
  const expectedDevelopmentUrl = "http://localhost:3001/preview"
  const expectedProductionUrl = "https://formlink.ai/preview"

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
