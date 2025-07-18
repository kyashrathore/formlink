"use client"

import { usePremium } from "@/app/hooks/usePremium"

interface FormBrandingProps {
  className?: string
}

export function FormBranding({ className }: FormBrandingProps) {
  const { isPro } = usePremium()

  // Don't show branding for Pro users
  if (isPro) {
    return null
  }

  return (
    <div
      className={`text-muted-foreground flex items-center justify-center p-2 text-xs ${className}`}
    >
      <a
        href="https://formlink.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground transition-colors"
      >
        Powered by FormLink
      </a>
    </div>
  )
}
