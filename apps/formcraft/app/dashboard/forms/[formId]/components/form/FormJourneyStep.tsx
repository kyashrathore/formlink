"use client"

import { Button, Card, Label, toast } from "@formlink/ui"
import { Wand2 } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"
import { useMobile } from "../../hooks/use-mobile"
import { useFormEditorStore } from "../../stores/useFormEditorStore"

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

      return content
    }

    return ""
  }, [journeyScript])

  const [journeyScriptContent, setJourneyScriptContent] =
    useState<string>(getInitialContent())

  const [isModified, setIsModified] = useState<boolean>(false)

  useEffect(() => {
    setJourneyScriptContent(getInitialContent())
    setIsModified(false)
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

      if (!isModified || isFirstContentArrival) {
        setJourneyScriptContent(content)
        setIsModified(false)
      }
    }
  }, [journeyScript, isModified, journeyScriptContent])

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setJourneyScriptContent(e.target.value)
      setIsModified(true)
    },
    []
  )

  const saveJourneyScript = useCallback(async () => {
    try {
      await updateSettingField("journeyScript", journeyScriptContent)
      setIsModified(false)
      toast({
        title: "Form journey saved successfully",
        status: "success",
      })
    } catch (error) {
      console.error("Error saving journey script:", error)
      toast({
        title: "Failed to save form journey",
        status: "error",
      })
    }
  }, [journeyScriptContent, updateSettingField])

  const loadTemplate = useCallback(() => {
    const confirmLoad = window.confirm(
      "This will replace your current journey script with the template. Continue?"
    )
    if (confirmLoad) {
      setJourneyScriptContent(DEFAULT_JOURNEY_TEMPLATE)
      setIsModified(true)
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
            <Button
              size="sm"
              onClick={saveJourneyScript}
              disabled={!isModified}
            >
              Save Journey
            </Button>
          </div>
        )}
      </div>
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <h3 className="mb-0 text-sm font-medium">
              Form Journey & Psychological Strategy
            </h3>
            <p className="text-muted-foreground text-sm">
              Define how your form should interact with users and maximize
              completion rates. This includes result page generation
              instructions.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Edit Journey Script</Label>
            <textarea
              value={journeyScriptContent}
              onChange={handleContentChange}
              placeholder="Start designing your form journey..."
              className="bg-background h-[400px] w-full resize-none rounded-md border px-3 py-2 font-mono text-sm"
            />
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-sm">
                {journeyScriptContent.length > 0 && (
                  <span>{journeyScriptContent.split(" ").length} words</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default FormJourneyStep
