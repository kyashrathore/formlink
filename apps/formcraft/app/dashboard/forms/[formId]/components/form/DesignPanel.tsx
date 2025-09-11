"use client"

import { parseShadcnCSS } from "@/lib/theme/parseShadcn"
import { useEffect, useState } from "react"
import ShadcnCSSPanel from "./ShadcnCSSPanel"

const validateShadcnCSS = (
  cssText: string
): { valid: boolean; error?: string } => {
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
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const [savedTheme, setSavedTheme] = useState<string | null>(null)
  const [themeLoading, setThemeLoading] = useState(true)
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">(
    "dark"
  )
  const [savingMode, setSavingMode] = useState(false)

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

          const mode =
            form.settings?.theme_overrides?.theme_mode || ("dark" as const)
          setThemeMode(mode)
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

  const handleSaveTheme = async (cssText: string) => {
    const validation = validateShadcnCSS(cssText)
    if (!validation.valid) {
      console.error("CSS validation failed:", validation.error)
      alert(`CSS Validation Error: ${validation.error}`)
      return
    }

    // Parse and canonicalize before applying/saving to ensure SSR stability
    const parsed = parseShadcnCSS(cssText)

    if (onShadcnCSSApply) {
      onShadcnCSSApply(parsed.css)
    }
    // Fire live-update event so preview forwards CSS immediately (even when not on Preview tab)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("FORMLINK_SHADCN_CSS_UPDATE", {
          detail: { cssText: parsed.css },
        })
      )
    }

    try {
      const currentFormResponse = await fetch(`/api/forms/${formId}`)
      let currentSettings: any = {}
      if (currentFormResponse.ok) {
        const currentForm = await currentFormResponse.json()
        currentSettings = currentForm.settings || {}
      }

      const overrides = {
        ...(currentSettings.theme_overrides || {}),
        shadcn_css: parsed.css,
        updated_at: new Date().toISOString(),
      }
      const themeData = {
        settings: {
          ...currentSettings,
          theme_overrides: overrides,
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
        // Keep local state in sync so the textarea shows the last saved theme
        setSavedTheme(parsed.css)
      }
    } catch (error) {
      console.error("Error saving theme to form:", error)
    }
  }

  const handleSaveAsBrandTheme = async (cssText: string) => {
    const validation = validateShadcnCSS(cssText)
    if (!validation.valid) {
      console.error("CSS validation failed:", validation.error)
      alert(`CSS Validation Error: ${validation.error}`)
      return
    }

    const parsed = parseShadcnCSS(cssText)
    setSavedTheme(parsed.css)

    if (onShadcnCSSApply) {
      onShadcnCSSApply(parsed.css)
    }
  }

  return (
    <div className={` ${className}`}>
      {/* Theme mode toggle */}
      <div className="mb-6">
        <div className="mb-2">
          <h3 className="text-sm font-medium">Theme Mode</h3>
          <p className="text-muted-foreground text-xs">
            Control light/dark mode for this form’s preview and share embeds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["system", "light", "dark"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`rounded-md border px-3 py-1.5 text-sm ${
                themeMode === m
                  ? "border-primary ring-primary/30 ring-2"
                  : "border-border"
              } disabled:opacity-50`}
              disabled={savingMode}
              onClick={async () => {
                if (themeMode === m) return
                setThemeMode(m)
                setSavingMode(true)
                try {
                  const currentFormResponse = await fetch(
                    `/api/forms/${formId}`
                  )
                  let currentSettings: any = {}
                  if (currentFormResponse.ok) {
                    const currentForm = await currentFormResponse.json()
                    currentSettings = currentForm.settings || {}
                  }
                  const nextOverrides = {
                    ...(currentSettings.theme_overrides || {}),
                    theme_mode: m,
                    updated_at: new Date().toISOString(),
                  }
                  const nextSettings = {
                    ...currentSettings,
                    theme_overrides: nextOverrides,
                  }
                  await fetch(`/api/forms/${formId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ settings: nextSettings }),
                  })
                  // Notify preview to update immediately
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("FORMLINK_THEME_MODE_UPDATE", {
                        detail: { mode: m },
                      })
                    )
                  }
                } catch (e) {
                  console.error("Failed to save theme mode:", e)
                } finally {
                  setSavingMode(false)
                }
              }}
            >
              {capitalize(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Shadcn CSS overrides */}
      <ShadcnCSSPanel
        onSaveTheme={handleSaveTheme}
        onSaveAsBrand={handleSaveAsBrandTheme}
        initialCssText={!themeLoading ? savedTheme || undefined : undefined}
        applicationStatus={shadcnStatus}
      />
    </div>
  )
}
