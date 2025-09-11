"use client"

import { Button } from "@formlink/ui"
import { Wand2 } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"
import { useMobile } from "../../hooks/use-mobile"
import { useFormEditorStore } from "../../stores/useFormEditorStore"
import StructuredPromptEditor from "./StructuredPromptEditor"

const DEFAULT_JOURNEY_TEMPLATE = `<form-journey>

<strategy>
**Form Purpose**: [Define the specific goal of this form]
**Target Audience**: [Who fills this out and why]
**Psychological Frame**: [Choose: Assessment | Survey | Application | Feedback | Quiz | Registration]
**Tone**: [Choose: Professional | Friendly Expert | Playful Guide | Trusted Advisor]
**Key Principles**:
- [Principle 1 - e.g., Build trust through transparency]
- [Principle 2 - e.g., Use social proof at friction points]
- [Principle 3 - e.g., Frame as exclusive opportunity]
</strategy>

<value-exchange-strategy>
Before sensitive questions (email, phone, payment), provide genuine value based on their previous answers:
- Insights derived from their responses
- Relevant statistics for their situation
- Mini-result previews
- Personalized recommendations
</value-exchange-strategy>

<branching-logic>
[Only include if form has conditional logic]
- If [condition based on answer]: [Show these questions/sections]
- If [user characteristic]: [Adjust approach/questions]
- Skip [section] when [condition]
</branching-logic>

<result-generation>
## Purpose
[What the result page should achieve - confirm submission, provide insights, offer next steps]

## Response Analysis
- If [answer pattern]: Show [specific content type]
- For [user segment]: Emphasize [particular value]
- When [condition]: Include [call to action]

## Content Structure
1. **Opening**: [How to acknowledge their specific input]
2. **Main Value**: [Core insights/results to provide]
3. **Next Steps**: [Clear actions they can take]

## Tone and Style
[How results should feel - celebratory, insightful, actionable, professional]
</result-generation>

</form-journey>`

interface FormJourneyStepProps {
  journeyScript: string
  userId?: string
  selectedTab: string
}

const FormJourneyStep: React.FC<FormJourneyStepProps> = ({
  journeyScript,
  selectedTab,
}) => {
  const { form, updateSettingField } = useFormEditorStore()
  const isMobile = useMobile()
  const shouldHideControls = isMobile && selectedTab === "content"

  const getInitialContent = useCallback(() => {
    if (!journeyScript) return ""

    if (typeof journeyScript === "string") {
      let content = journeyScript

      if (content.includes("\\n")) {
        try {
          content = content.replace(/\\n/g, "\n").replace(/\\"/g, '"')
        } catch (e) {
          console.error("Error unescaping journeyScript:", e)
        }
      }

      // If the journeyScript arrived as a JSON-quoted string, strip the wrapping quotes
      if (
        (content.startsWith('"') && content.endsWith('"')) ||
        (content.startsWith("'") && content.endsWith("'"))
      ) {
        content = content.slice(1, -1)
      }

      return content
    }

    return ""
  }, [journeyScript])

  const [journeyScriptContent, setJourneyScriptContent] =
    useState<string>(getInitialContent())

  // No local save button; we mark the form dirty via store updates

  useEffect(() => {
    setJourneyScriptContent(getInitialContent())
    // reset when switching forms
  }, [form?.id])

  useEffect(() => {
    const wasEmpty = !journeyScriptContent
    const nowHasContent = !!journeyScript
    const isFirstContentArrival = wasEmpty && nowHasContent

    if (journeyScript && typeof journeyScript === "string") {
      let content = journeyScript

      if (content.includes("\n")) {
        content = content.replace(/\n/g, "\n").replace(/\"/g, '"')
      }

      if (isFirstContentArrival) {
        setJourneyScriptContent(content)
      }
    }
  }, [journeyScript, journeyScriptContent])

  const loadTemplate = useCallback(() => {
    const confirmLoad = window.confirm(
      "This will replace your current journey script with the template. Continue?"
    )
    if (confirmLoad) {
      setJourneyScriptContent(DEFAULT_JOURNEY_TEMPLATE)
      updateSettingField("journeyScript", DEFAULT_JOURNEY_TEMPLATE)
    }
  }, [])

  return (
    <div
      id="form-journey-step"
      data-spy-section="form-journey-step"
      className="mt-8 flex w-full scroll-mt-8 flex-col"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-semibold">Form Journey</div>
        {!shouldHideControls && (
          <div className="flex items-center gap-2">
            {!journeyScriptContent.trim() && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadTemplate}
                className="flex items-center gap-2"
              >
                <Wand2 className="h-4 w-4" />
                Load Template
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <StructuredPromptEditor
            initialContent={journeyScriptContent}
            height="400px"
            onChange={(xml) => {
              setJourneyScriptContent(xml)
              updateSettingField("journeyScript", xml)
            }}
            description="Define how your form should interact with users and maximize
              completion rates. This includes result page generation
              instructions."
          />
        </div>
      </div>
    </div>
  )
}

export default FormJourneyStep
