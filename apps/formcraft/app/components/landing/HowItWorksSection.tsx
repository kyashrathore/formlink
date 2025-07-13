"use client"

import { Edit3, Megaphone, Send } from "lucide-react"
import React from "react"
import { GridCard } from "./GridCard"
import { SectionHeader } from "./SectionHeader"

const steps = [
  {
    icon: <Edit3 className="h-6 w-6" />,
    stepNumber: 1,
    stepLabel: "Step One",
    title: "Describe Your Form",
    description:
      "Start a conversation with the AI. Provide as much detail as you like.",
    example:
      '"Create a contact form with fields for name, email, and a multi-line message box. Make the name and email fields required."',
  },
  {
    icon: <Megaphone className="h-6 w-6" />,
    stepNumber: 2,
    stepLabel: "Step Two",
    title: "Refine in Real-Time",
    description:
      "The AI will ask clarifying questions to ensure it gets every detail right. Need a change? Just ask.",
    example:
      '"Add a file upload field for PDFs only," or "Change the message box to a single-line text field."',
  },
  {
    icon: <Send className="h-6 w-6" />,
    stepNumber: 3,
    stepLabel: "Step Three",
    title: "Deploy Instantly",
    description:
      "Preview your form directly in the chat. When it's perfect, deploy it instantly with a shareable link, QR code, or embed.",
    example: null,
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="container-custom">
        <SectionHeader title="How It Works in 3 Simple Steps" />

        <div className="bg-border border-border grid grid-cols-1 gap-[1px] border md:grid-cols-3">
          {steps.map((step, index) => (
            <GridCard key={index}>
              <div className="text-muted-foreground mb-3">{step.icon}</div>
              <div className="text-muted-foreground mb-3 flex items-center gap-3 text-sm">
                <span className="bg-foreground text-background inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                  {step.stepNumber}
                </span>
                {step.stepLabel}
              </div>
              <h3 className="mb-4 text-2xl font-bold">{step.title}</h3>
              <p className="text-muted-foreground mb-4 text-base leading-relaxed">
                {step.description}
              </p>
              {step.example && (
                <span className="text-muted-foreground mt-3 block text-sm italic">
                  {step.example}
                </span>
              )}
            </GridCard>
          ))}
        </div>
      </div>
    </section>
  )
}
