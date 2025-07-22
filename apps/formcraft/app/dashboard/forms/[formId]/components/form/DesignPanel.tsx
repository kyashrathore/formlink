"use client"

import { useEffect, useState } from "react"
import ShadcnCSSPanel from "./ShadcnCSSPanel"

// CSS validation function similar to tweakcn logic
const validateShadcnCSS = (
  cssText: string
): { valid: boolean; error?: string } => {
  // Basic validation like tweakcn
  if (!cssText.trim()) {
    return { valid: false, error: "Please enter CSS content" }
  }

  if (!cssText.includes("--") || !cssText.includes(":")) {
    return {
      valid: false,
      error:
        "Invalid CSS format. CSS should contain variable definitions like --primary: #color",
    }
  }

  // Check for required blocks
  if (!cssText.includes(":root") && !cssText.includes(".dark")) {
    return {
      valid: false,
      error: "CSS should contain :root and/or .dark selectors",
    }
  }

  return { valid: true }
}

interface DesignPanelProps {
  formId: string
  onShadcnCSSApply?: (cssText: string) => void
  shadcnStatus?: {
    loading: boolean
    error?: string
    success?: boolean
    appliedRootVariables?: string[]
    appliedDarkVariables?: string[]
    warnings?: string[]
  }
  className?: string
}

export default function DesignPanel({
  formId,
  onShadcnCSSApply,
  shadcnStatus = { loading: false },
  className = "",
}: DesignPanelProps) {
  // State for tracking applied themes
  const [appliedTheme, setAppliedTheme] = useState<string | null>(null)

  // State for saved theme loading
  const [savedTheme, setSavedTheme] = useState<string | null>(null)
  const [themeLoading, setThemeLoading] = useState(true)

  // Load saved theme on mount
  useEffect(() => {
    const loadSavedTheme = async () => {
      if (!formId) return

      try {
        setThemeLoading(true)

        const response = await fetch(`/api/forms/${formId}`)
        if (response.ok) {
          const form = await response.json()

          if (form.settings?.theme_overrides?.shadcn_css) {
            setSavedTheme(form.settings.theme_overrides.shadcn_css)
          } else {
            setSavedTheme(null)
          }
        } else {
          setSavedTheme(null)
        }
      } catch (error) {
        console.error("Error loading saved theme:", error)
        setSavedTheme(null)
      } finally {
        setThemeLoading(false)
      }
    }

    loadSavedTheme()
  }, [formId])

  // Handle saving theme (auto-applies and saves)
  const handleSaveTheme = async (cssText: string) => {
    // Validate CSS first
    const validation = validateShadcnCSS(cssText)
    if (!validation.valid) {
      console.error("CSS validation failed:", validation.error)
      alert(`CSS Validation Error: ${validation.error}`)
      return
    }

    setAppliedTheme(cssText)

    // Auto-apply the theme first
    if (onShadcnCSSApply) {
      onShadcnCSSApply(cssText)
    }

    // Save the theme to the form
    try {
      // First fetch current settings to merge properly
      const currentFormResponse = await fetch(`/api/forms/${formId}`)
      let currentSettings = {}
      if (currentFormResponse.ok) {
        const currentForm = await currentFormResponse.json()
        currentSettings = currentForm.settings || {}
      }

      const themeData = {
        settings: {
          ...currentSettings,
          theme_overrides: {
            shadcn_css: cssText,
            updated_at: new Date().toISOString(),
          },
        },
      }

      const response = await fetch(`/api/forms/${formId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(themeData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("Failed to save theme to form:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        })
      } else {
        const responseData = await response.json()
      }
    } catch (error) {
      console.error("Error saving theme to form:", error)
    }
  }

  // Handle saving as brand theme (auto-applies and saves as brand)
  const handleSaveAsBrandTheme = async (cssText: string) => {
    // Validate CSS first
    const validation = validateShadcnCSS(cssText)
    if (!validation.valid) {
      console.error("CSS validation failed:", validation.error)
      alert(`CSS Validation Error: ${validation.error}`)
      return
    }

    setAppliedTheme(cssText)

    // Auto-apply the theme first
    if (onShadcnCSSApply) {
      onShadcnCSSApply(cssText)
    }

    // In real implementation, this would call a brand theme API endpoint
  }

  return (
    <div className={` ${className}`}>
      {/* Shadcn CSS Panel */}
      <ShadcnCSSPanel
        onSaveTheme={handleSaveTheme}
        onSaveAsBrand={handleSaveAsBrandTheme}
        initialCssText={!themeLoading ? savedTheme || undefined : undefined}
        applicationStatus={shadcnStatus}
      />
    </div>
  )
}
