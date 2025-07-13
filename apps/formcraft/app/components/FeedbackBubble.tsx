"use client"

import { Button } from "@formlink/ui"
import { MessageCircle } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import posthog from "posthog-js"
import { useEffect, useState } from "react"

export function FeedbackBubble() {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Show bubble after a small delay for better UX
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  // Don't show on feedback page itself
  if (pathname === "/feedback") return null

  const handleClick = () => {
    posthog.capture("feedback_bubble_clicked", {
      from_page: pathname,
    })
  }

  return (
    <div
      className={`fixed right-6 bottom-6 z-50 transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
      }`}
    >
      <div className="relative">
        {/* Pulse animation ring */}
        <div className="bg-primary absolute inset-0 animate-ping rounded-full opacity-25" />

        <Button
          asChild
          size="lg"
          className="group bg-primary hover:bg-primary/90 relative h-14 w-14 rounded-full shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl"
          onClick={handleClick}
        >
          <Link href="/feedback" aria-label="Give feedback">
            <MessageCircle className="h-6 w-6" />
            <span className="sr-only">Give feedback</span>
          </Link>
        </Button>

        {/* Tooltip on hover */}
        <div className="pointer-events-none absolute right-0 bottom-full mb-2">
          <div className="bg-popover text-popover-foreground rounded-md border px-3 py-1.5 text-sm whitespace-nowrap opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
            Share feedback
          </div>
        </div>
      </div>
    </div>
  )
}
