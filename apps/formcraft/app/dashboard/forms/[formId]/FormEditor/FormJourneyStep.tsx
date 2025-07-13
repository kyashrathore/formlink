"use client"

import { useMobile } from "@/hooks/use-mobile"
import { Button, Card, Label, toast } from "@formlink/ui"
import { Edit, Eye, Wand2 } from "lucide-react"
import { marked } from "marked"
import React, { useCallback, useEffect, useState } from "react"
import { useFormStore } from "./useFormStore"

// Helper to strip HTML for plain text
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}

// Transform custom tags to markdown format
const transformCustomTags = (content: string): string => {
  if (!content) return ""

  let processedContent = content

  // Replace custom tags with markdown section markers
  const tagMappings: { [key: string]: string } = {
    "form-journey": "# Form Journey",
    strategy: "## Strategy",
    "value-exchange-strategy": "## Value Exchange Strategy",
    "branching-logic": "## Branching Logic",
    "result-generation": "## Result Generation",
  }

  // Replace opening tags with markdown headers
  Object.entries(tagMappings).forEach(([tag, header]) => {
    processedContent = processedContent.replace(
      new RegExp(`<${tag}>`, "gi"),
      `${header}\n`
    )
  })

  // Remove closing tags
  processedContent = processedContent.replace(/<\/[^>]+>/g, "\n")

  // Ensure proper spacing for markdown elements
  processedContent = processedContent.replace(/\n(#{1,6} )/g, "\n\n$1")

  // Clean up excessive newlines
  processedContent = processedContent.replace(/\n{3,}/g, "\n\n")

  return processedContent.trim()
}

// Default journey script template
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

const FormJourneyStep = ({
  userId,
  selectedTab,
}: {
  userId: string
  selectedTab: string
}) => {
  const { form, updateSettingField } = useFormStore()
  const isMobile = useMobile()
  const shouldHideControls = isMobile && selectedTab === "content"

  console.log("[FormJourneyStep] Component rendered", {
    formId: form?.id,
    hasJourneyScript: !!form?.settings?.journeyScript,
    journeyScriptLength: form?.settings?.journeyScript?.length,
    journeyScriptPreview: form?.settings?.journeyScript?.substring(0, 50) + "..."
  })

  // Get initial content from form settings
  const getInitialContent = useCallback(() => {
    const journeyScript = form?.settings?.journeyScript

    console.log("[FormJourneyStep] getInitialContent called", {
      hasJourneyScript: !!journeyScript,
      journeyScriptType: typeof journeyScript
    })

    if (!journeyScript) return ""

    // Handle case where journeyScript might be a JSON string
    if (typeof journeyScript === "string") {
      let content = journeyScript

      // Check if it's escaped, need to unescape
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
  }, [form?.settings?.journeyScript])

  // State for the raw content (preserves tags)
  const [journeyScriptContent, setJourneyScriptContent] =
    useState<string>(getInitialContent())
  // State for preview mode vs edit mode
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(true)
  // State to track if content has been modified
  const [isModified, setIsModified] = useState<boolean>(false)
  
  // Reset state when form ID changes
  useEffect(() => {
    console.log("[FormJourneyStep] Form ID changed, resetting state", {
      formId: form?.id,
      hadContent: !!journeyScriptContent
    })
    setJourneyScriptContent(getInitialContent())
    setIsModified(false)
    setIsPreviewMode(true)
  }, [form?.id]) // Only depend on form ID, not getInitialContent

  useEffect(() => {
    const currentContent = form?.settings?.journeyScript

    // Check if this is first content arrival (was empty, now has content)
    const wasEmpty = !journeyScriptContent
    const nowHasContent = !!currentContent
    const isFirstContentArrival = wasEmpty && nowHasContent

    if (currentContent && typeof currentContent === "string") {
      let content = currentContent

      // Handle escaped strings
      if (content.includes("\\n")) {
        content = content.replace(/\\n/g, "\n").replace(/\\"/g, '"')
      }

      // Only update content when not modified or first arrival
      if (!isModified || isFirstContentArrival) {
        setJourneyScriptContent(content)
        setIsModified(false)
      }
    }
  }, [form?.settings?.journeyScript, isModified, journeyScriptContent])

  // Handle content changes in edit mode
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setJourneyScriptContent(e.target.value)
      setIsModified(true)
    },
    []
  )

  const saveJourneyScript = useCallback(async () => {
    try {
      // Save the raw content with tags preserved
      await updateSettingField("journeyScript", journeyScriptContent)
      setIsModified(false)
      setIsPreviewMode(true)
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
      setIsPreviewMode(false) // Switch to edit mode to show the template
    }
  }, [])

  // Get preview content by transforming tags to markdown
  const getPreviewContent = useCallback(() => {
    const transformedContent = transformCustomTags(journeyScriptContent)
    try {
      return marked.parse(transformedContent) as string
    } catch (e) {
      console.error("Error parsing markdown:", e)
      return transformedContent
    }
  }, [journeyScriptContent])

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
            {journeyScriptContent.trim() && (
              <>
                {isPreviewMode ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPreviewMode(false)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPreviewMode(true)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveJourneyScript}
                      disabled={!journeyScriptContent.trim()}
                    >
                      Save Journey
                    </Button>
                  </>
                )}
              </>
            )}
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
          {isPreviewMode ? (
            <div className="space-y-2">
              <Label>Journey Script</Label>
              <div
                className="prose dark:prose-invert min-h-[200px] max-w-none rounded-lg border p-4 text-sm"
                dangerouslySetInnerHTML={{ __html: getPreviewContent() }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Edit Journey Script</Label>
              <textarea
                value={journeyScriptContent}
                onChange={handleContentChange}
                placeholder="Start designing your form journey..."
                className="bg-background min-h-[400px] w-full rounded-md border px-3 py-2 font-mono text-sm"
              />
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  {journeyScriptContent.length > 0 && (
                    <span>{journeyScriptContent.split(" ").length} words</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default FormJourneyStep
