"use client"

import {
  Calculator,
  CheckCircle2,
  FileText,
  Link2,
  MessageSquare,
  Upload,
} from "lucide-react"
import React from "react"
import { GridCard } from "./GridCard"
import { SectionHeader } from "./SectionHeader"

const features = [
  {
    icon: <MessageSquare className="h-6 w-6" />,
    category: "Core Feature",
    title: "Conversational Form Building",
    description:
      "The core of our platform. Build and edit forms using natural language.",
  },
  {
    icon: <CheckCircle2 className="h-6 w-6" />,
    category: "Logic & Flow",
    title: "Effortless Conditional Logic",
    description: "Implement complex branching and logic with a simple request.",
  },
  {
    icon: <FileText className="h-6 w-6" />,
    category: "Multi-Page Forms",
    title: "Smart Multi-Page Forms",
    description:
      "Break up long forms into easy-to-navigate sections with progress bars to improve completion rates.",
  },
  {
    icon: <Upload className="h-6 w-6" />,
    category: "File Management",
    title: "File Uploads",
    description:
      "Easily add fields for users to upload documents, images, or other files with specific constraints.",
  },
  {
    icon: <Calculator className="h-6 w-6" />,
    category: "Calculations",
    title: "Calculated Fields",
    description:
      "Perfect for quizzes, order forms, or quotes. Create fields that automatically calculate totals or scores.",
  },
  {
    icon: <Link2 className="h-6 w-6" />,
    category: "Integration",
    title: "Webhook Integration",
    description:
      "Connect your forms to thousands of other applications. Send form data to any service that accepts webhooks.",
  },
]

export const FeaturesSection = React.memo(function FeaturesSection() {
  return (
    <section id="features" className="bg-muted/30 py-20">
      <div className="container-custom">
        <SectionHeader
          title="Features That Go Beyond a Simple Builder"
          subtitle="Formfiller isn't just about creating forms; it's about creating possibilities through conversation."
        />

        <div className="bg-border border-border grid grid-cols-1 gap-[1px] border md:grid-cols-3">
          {features.map((feature, index) => (
            <GridCard key={index}>
              <div className="text-muted-foreground mb-3">{feature.icon}</div>
              <div className="text-muted-foreground mb-3 text-sm">
                {feature.category}
              </div>
              <h3 className="mb-4 text-2xl leading-tight font-bold">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                {feature.description}
              </p>
            </GridCard>
          ))}
        </div>
      </div>
    </section>
  )
})
