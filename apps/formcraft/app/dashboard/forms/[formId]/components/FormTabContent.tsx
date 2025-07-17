"use client"

import { FileText } from "lucide-react"
import { useFormStore } from "../stores/useFormStore"
import FormEditor from "./form/FormEditor"

// Mock user object for testing - in real app this would come from auth
const mockUser = {
  id: "test-user-id",
}

interface FormTabContentProps {
  formId: string
}

export default function FormTabContent({ formId }: FormTabContentProps) {
  const { form } = useFormStore()

  // Note: Form creation now happens through chat interactions
  // The bridge pattern in TestUIPage syncs agent updates to useFormStore

  // Wait for form data from stream - no local form creation
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

  // Form editing interface - form data comes from real-time stream
  return (
    <div className="bg-background flex h-full flex-col overflow-auto">
      {/* Header */}
      <div className="bg-card/50 border-border/50 flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center space-x-2">
          <FileText className="text-muted-foreground h-4 w-4" />
          <span className="text-foreground text-sm font-medium">
            Form Builder
          </span>
        </div>
        <div className="text-muted-foreground text-xs">
          Real-time updates enabled
        </div>
      </div>

      <div className="flex-1 p-4">
        <FormEditor user={mockUser} selectedTab="form" />
      </div>
    </div>
  )
}
