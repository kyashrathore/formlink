"use client"

import { analytics } from "@/app/lib/analytics"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="border-border bg-background h-9 w-9 rounded-md border" />
    )
  }

  return (
    <button
      onClick={() => {
        const newTheme = theme === "dark" ? "light" : "dark"
        setTheme(newTheme)
        // Determine if we're in mobile menu based on parent elements
        const isInMobileMenu =
          typeof window !== "undefined" && window.innerWidth < 768
        analytics.themeSwitcherUsed(
          newTheme,
          isInMobileMenu ? "mobile_menu" : "header"
        )
      }}
      className="border-border bg-background hover:bg-accent flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <svg
          className="text-foreground h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg
          className="text-foreground h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
