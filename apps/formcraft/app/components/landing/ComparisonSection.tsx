"use client"

import { Check, X } from "lucide-react"
import React from "react"
import { GridCard } from "./GridCard"
import { SectionHeader } from "./SectionHeader"

const oldWayItems = [
  {
    title: "Hours Wasted",
    description: "Manually dragging, dropping, and aligning fields.",
  },
  {
    title: "Logic Headaches",
    description: "Building conditional logic feels like complex coding.",
  },
  {
    title: "Mobile Nightmares",
    description: "Forms that look great on desktop break on mobile devices.",
  },
  {
    title: "Steep Learning Curves",
    description: "Every traditional builder has its own frustrating quirks.",
  },
]

const formlinkWayItems = [
  {
    title: "Seconds to Create",
    description: "Describe your form and the AI builds it instantly.",
  },
  {
    title: "Effortless Intelligence",
    description:
      "Simply ask for logic. \"If the user selects 'Yes', show them the next section.\"",
  },
  {
    title: "Perfect on Every Device",
    description:
      "Every form is automatically responsive and looks professional everywhere.",
  },
  {
    title: "Zero Learning Curve",
    description: "If you can describe it, you can build it. It's that simple.",
  },
]

export const ComparisonSection = React.memo(function ComparisonSection() {
  return (
    <section className="py-20">
      <div className="container-custom">
        <SectionHeader
          title="The Old Way vs. The Formfiller Way"
          subtitle="Tired of the slow, frustrating process of building forms? There's a smarter way."
        />

        <div className="bg-border border-border grid grid-cols-1 gap-[1px] border md:grid-cols-2">
          <GridCard>
            <div className="mb-3">
              <X className="text-muted-foreground mb-3 h-6 w-6" />
            </div>
            <div className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
              The Old Way
            </div>
            <h3 className="mb-4 text-2xl font-bold">
              Traditional Form Builders
            </h3>
            <p className="mb-4 text-lg">The Pain Points</p>

            <div className="space-y-5">
              {oldWayItems.map((item, index) => (
                <div key={index}>
                  <strong className="mb-1 block text-base">{item.title}</strong>
                  <span className="text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </span>
                </div>
              ))}
            </div>
          </GridCard>

          <GridCard>
            <div className="mb-3">
              <Check className="text-muted-foreground mb-3 h-6 w-6" />
            </div>
            <div className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
              The Formfiller Way
            </div>
            <h3 className="mb-4 text-2xl font-bold">AI-Powered Creation</h3>
            <p className="mb-4 text-lg">The Gains</p>

            <div className="space-y-5">
              {formlinkWayItems.map((item, index) => (
                <div key={index}>
                  <strong className="mb-1 block text-base">{item.title}</strong>
                  <span className="text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </span>
                </div>
              ))}
            </div>
          </GridCard>
        </div>
      </div>
    </section>
  )
})
