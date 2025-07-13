"use client"

import { useAuth } from "@/app/hooks/useAuth"
import { cn } from "@/app/lib"
import { analytics } from "@/app/lib/analytics"
import { Check, MessageSquare } from "lucide-react"
import Link from "next/link"
import React from "react"
import { SectionHeader } from "./SectionHeader"

const currentFeatures = [
  "Unlimited forms",
  "AI-powered form creation",
  "Conditional logic",
  "Multi-page forms",
  "File uploads",
  "Calculated fields",
  "Webhook integrations",
  "Mobile responsive",
  "Real-time preview",
  "Export responses",
]

export function PricingSection() {
  const { user, isAnonymous } = useAuth()

  return (
    <section id="pricing" className="bg-muted/30 py-20">
      <div className="container-custom">
        <SectionHeader
          title="Simple, Transparent Pricing"
          subtitle="Everything you need to build amazing forms, completely free"
        />

        <div className="mx-auto max-w-4xl">
          <div className="bg-background overflow-hidden rounded-2xl border shadow-sm">
            <div className="p-8 md:p-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-baseline gap-2">
                    <h3 className="text-3xl font-bold">FREE</h3>
                    <span className="text-muted-foreground text-sm">
                      forever
                    </span>
                  </div>
                  <p className="text-muted-foreground mb-6 text-lg">
                    All features included. No hidden costs.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {currentFeatures.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="text-primary h-4 w-4 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4 md:ml-8">
                  <Link
                    href={user && !isAnonymous ? "/dashboard" : "/auth"}
                    className={cn(
                      "inline-flex items-center justify-center",
                      "rounded-lg px-8 py-4",
                      "bg-foreground text-background",
                      "text-lg font-semibold",
                      "hover:-translate-y-0.5 hover:shadow-lg",
                      "transition-all duration-200"
                    )}
                    onClick={() => {
                      const ctaType =
                        user && !isAnonymous ? "go_dashboard" : "start_free"
                      const userType = user
                        ? isAnonymous
                          ? "anonymous"
                          : "authenticated"
                        : "unauthenticated"
                      analytics.landingCTAClicked(ctaType, userType, "pricing")
                    }}
                  >
                    {user && !isAnonymous
                      ? "Go to Dashboard"
                      : "Create Free Account"}
                  </Link>

                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">
                      No credit card required
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 border-t p-6 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <MessageSquare className="text-primary h-5 w-5" />
                    <h4 className="font-semibold">Help us build the future</h4>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    We're working on premium features. What would you like to
                    see next?
                  </p>
                </div>
                <Link
                  href="/feedback"
                  className={cn(
                    "inline-flex items-center justify-center",
                    "rounded-lg px-6 py-3",
                    "border-primary text-primary border",
                    "text-sm font-medium",
                    "hover:bg-primary hover:text-primary-foreground",
                    "transition-all duration-200"
                  )}
                >
                  Share Your Ideas
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
