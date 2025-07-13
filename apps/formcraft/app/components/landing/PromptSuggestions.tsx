"use client"

import { cn } from "@/app/lib"
import { analytics } from "@/app/lib/analytics"
import {
  Briefcase,
  Calendar,
  GraduationCap,
  Heart,
  Mail,
  MessageSquare,
  ShoppingBag,
  Users,
} from "lucide-react"
import React, { useMemo } from "react"

interface PromptSuggestion {
  icon: React.ReactNode
  heading: string
  description: string
  prompt: string
}

const suggestions: PromptSuggestion[] = [
  {
    icon: <MessageSquare className="h-5 w-5" />,
    heading: "Customer Feedback",
    description: "Collect valuable feedback from your customers",
    prompt:
      "Create a customer feedback form with rating scales for product quality, customer service, and overall satisfaction, plus a comments section for detailed feedback",
  },
  {
    icon: <Users className="h-5 w-5" />,
    heading: "Event Registration",
    description: "Manage event attendees efficiently",
    prompt:
      "Build an event registration form with attendee information, dietary restrictions, session preferences, and payment options",
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    heading: "Appointment Booking",
    description: "Schedule appointments seamlessly",
    prompt:
      "Design an appointment booking form with date/time selection, service options, contact information, and special requirements",
  },
  {
    icon: <ShoppingBag className="h-5 w-5" />,
    heading: "Product Survey",
    description: "Understand customer preferences",
    prompt:
      "Create a product survey with questions about usage frequency, feature preferences, pricing feedback, and improvement suggestions",
  },
  {
    icon: <Briefcase className="h-5 w-5" />,
    heading: "Job Application",
    description: "Streamline your hiring process",
    prompt:
      "Build a job application form with personal details, work experience, education, skills assessment, and document upload capabilities",
  },
  {
    icon: <Heart className="h-5 w-5" />,
    heading: "Volunteer Sign-up",
    description: "Recruit volunteers for your cause",
    prompt:
      "Create a volunteer registration form with availability, skills, interests, emergency contacts, and background check consent",
  },
  {
    icon: <GraduationCap className="h-5 w-5" />,
    heading: "Course Enrollment",
    description: "Manage student registrations",
    prompt:
      "Design a course enrollment form with student information, course selection, prerequisites check, and payment details",
  },
  {
    icon: <Mail className="h-5 w-5" />,
    heading: "Newsletter Signup",
    description: "Grow your email list",
    prompt:
      "Build a newsletter signup form with email, name, content preferences, frequency options, and GDPR consent checkbox",
  },
]

interface PromptSuggestionsProps {
  onSelectPrompt: (prompt: string) => void
  className?: string
}

export function PromptSuggestions({
  onSelectPrompt,
  className,
}: PromptSuggestionsProps) {
  return (
    <div className={cn("w-full", className)}>
      <p className="text-muted-foreground mb-4 text-center text-sm">
        Popular forms to get you started:
      </p>

      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => {
              analytics.promptSuggestionClicked(suggestion.heading, index)
              onSelectPrompt(suggestion.prompt)
            }}
            className={cn(
              "group bg-background relative rounded-lg border p-4",
              "hover:border-primary/50 hover:bg-accent/5",
              "text-left transition-all duration-200",
              "cursor-pointer"
            )}
            aria-label={`Create ${suggestion.heading} form`}
          >
            <div className="flex items-start gap-3">
              <div className="text-muted-foreground group-hover:text-primary transition-colors">
                {suggestion.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="group-hover:text-primary mb-1 text-sm font-medium transition-colors">
                  {suggestion.heading}
                </h4>
                <p className="text-muted-foreground line-clamp-2 text-xs">
                  {suggestion.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
