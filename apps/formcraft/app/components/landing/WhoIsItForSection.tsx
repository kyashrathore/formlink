"use client"

import { ClipboardList, Code2, TrendingUp, Zap } from "lucide-react"
import React from "react"
import { GridCard } from "./GridCard"
import { SectionHeader } from "./SectionHeader"

const personas = [
  {
    icon: <TrendingUp className="h-6 w-6" />,
    category: "Marketing Teams",
    title: "Marketers",
    description:
      "Launch lead generation campaigns in minutes, not days. A/B test different form concepts with unparalleled speed.",
  },
  {
    icon: <ClipboardList className="h-6 w-6" />,
    category: "Product Teams",
    title: "Product Managers",
    description:
      "Gather targeted user feedback and validate new ideas without tying up engineering resources.",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    category: "Startups",
    title: "Entrepreneurs & Startups",
    description:
      "Build, test, and iterate on your minimum viable product faster than ever. Perfect for waitlists, sign-up forms, and initial customer feedback.",
  },
  {
    icon: <Code2 className="h-6 w-6" />,
    category: "Development Teams",
    title: "Developers",
    description:
      "Offload tedious form-building tasks. Quickly generate prototypes or internal tools and focus on more complex engineering challenges.",
  },
]

export function WhoIsItForSection() {
  return (
    <section id="use-cases" className="bg-muted/30 py-20">
      <div className="container-custom">
        <SectionHeader title="Who is Formlink.ai For?" />

        <div className="bg-border border-border grid grid-cols-1 gap-[1px] border md:grid-cols-2">
          {personas.map((persona, index) => (
            <GridCard key={index}>
              <div className="text-muted-foreground mb-3">{persona.icon}</div>
              <div className="text-muted-foreground mb-3 text-sm">
                {persona.category}
              </div>
              <h3 className="mb-4 text-2xl font-bold">{persona.title}</h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                {persona.description}
              </p>
            </GridCard>
          ))}
        </div>
      </div>
    </section>
  )
}
