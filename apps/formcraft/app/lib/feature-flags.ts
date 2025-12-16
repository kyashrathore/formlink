/**
 * Feature flags for progressive rollout of new features
 */

// Feature flag definitions
export const FEATURE_FLAGS = {
  FORM_GENERATION_ANALYTICS: true, // Enable analytics tracking
  PROGRESSIVE_QUESTION_RENDERING: true, // Enable progressive rendering of questions
  ACTIONS_COMPOSIO_ENABLED: process.env.ACTIONS_COMPOSIO_ENABLED === "true",
  CODEGEN_PREVIEW_UI:
    process.env.CODEGEN_PREVIEW_UI === "true" ||
    process.env.NEXT_PUBLIC_CODEGEN_PREVIEW_UI === "true" ||
    true,
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  // In development, allow override via environment variables
  if (process.env.NODE_ENV === "development") {
    const envKey = `NEXT_PUBLIC_FEATURE_${flag}`
    const envValue = process.env[envKey]
    if (envValue !== undefined) {
      return envValue === "true"
    }
  }

  return FEATURE_FLAGS[flag] ?? false
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter((flag) =>
    isFeatureEnabled(flag)
  )
}
