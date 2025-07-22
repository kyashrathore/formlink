/**
 * Test utility to verify preview configuration for FormFiller
 */

import {
  getAllowedPreviewOrigins,
  validatePreviewOrigin,
} from "./preview-config";

export function testPreviewConfiguration() {
  // Test allowed origins configuration
  const allowedOrigins = getAllowedPreviewOrigins();

  // Test environment variables
  const allowedOriginsEnv = process.env.NEXT_PUBLIC_ALLOWED_PREVIEW_ORIGINS;

  const nodeEnv = process.env.NODE_ENV;

  // Test origin validation
  const testOrigins = [
    "http://localhost:3000",
    "https://app.formcraft.com",
    "https://formlink.ai",
    "https://malicious-site.com", // Should be rejected
  ];

  const validationResults = testOrigins.map((origin) => ({
    origin,
    isValid: validatePreviewOrigin(origin),
  }));

  // Validate configuration based on environment
  let configurationValid = false;

  if (nodeEnv === "development") {
    configurationValid = allowedOrigins.some((origin) =>
      origin.includes("localhost"),
    );
  } else {
    configurationValid = allowedOrigins.some(
      (origin) =>
        origin.includes("formcraft.com") || origin.includes("formlink.ai"),
    );
  }

  return {
    allowedOrigins,
    allowedOriginsEnv,
    nodeEnv,
    isConfigured: Boolean(allowedOriginsEnv),
    validationResults,
    configurationValid,
  };
}
