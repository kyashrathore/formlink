"use client"

import { FileText } from "lucide-react"
import { useFormEditorStore } from "../stores/useFormEditorStore"
import { useFormGenerationStore } from "../stores/useFormGenerationStore"
import FormEditor from "./form/FormEditor"
import { MetadataShimmer, QuestionsShimmer } from "./form/shimmers/FormShimmers"

const mockUser = {
  id: "test-user-id",
  app_metadata: {},
  user_metadata: {},
  aud: "",
  created_at: "",
}

export default function FormTabContent() {
  const { form: initialForm, isLoading } = useFormEditorStore()
  const { currentForm, isFormGenerating } = useFormGenerationStore()
  const form = currentForm || initialForm

  if (isLoading || isFormGenerating) {
    return (
      <div className="bg-background flex h-full flex-col space-y-4 overflow-auto p-4">
        <MetadataShimmer />
        <QuestionsShimmer count={3} />
      </div>
    )
  }

  if (!form) {
    return (
      <div className="bg-background flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md space-y-6 text-center">
            <div className="bg-primary/10 mx-auto flex h-20 w-20 items-center justify-center rounded-full">
              <FileText className="text-primary h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-foreground text-2xl font-semibold">
                Start in Chat
              </h2>
              <p className="text-muted-foreground">
                Use the chat panel to describe your form. The AI will help you
                build it step by step, and changes will appear here in
                real-time.
              </p>
            </div>
            <div className="text-muted-foreground bg-muted/50 rounded-lg p-4 text-sm">
              💡 Try: "Create a contact form with name, email, and message
              fields"
            </div>
          </div>
        </div>
      </div>
    )
  }

  const hasFormContent = form.questions && form.questions.length > 0

  return (
    <div className="bg-background flex h-full flex-col overflow-auto">
      <div className="relative flex-1">
        <div className="absolute inset-0 block">
          <div className="h-full p-4">
            <FormEditor user={mockUser} selectedTab="form" />
          </div>
        </div>
      </div>
    </div>
  )
}
