/**
 * Simplified theme types for shadcn/ui CSS variable system
 */

/**
 * PostMessage theme communication types
 */
export interface ShadcnCSSUpdateMessage {
  type: "SHADCN_CSS_UPDATE"
  payload: {
    css: string
    timestamp: number
  }
}

export interface FormfillerThemeAppliedMessage {
  type: "FORMFILLER_THEME_APPLIED"
  payload: {
    success: boolean
    error?: string
    appliedProperties: string[]
    timestamp: number
  }
}

export type ThemePostMessage =
  | ShadcnCSSUpdateMessage
  | FormfillerThemeAppliedMessage
