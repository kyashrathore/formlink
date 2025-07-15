"use client"

import { useAuth } from "@/app/hooks/useAuth"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import ChatDesignPanel from "./components/ChatDesignPanel"
import ChatTabContent from "./components/ChatTabContent"
import DesignTabContent from "./components/DesignTabContent"
import FloatingPanel from "./components/FloatingPanel"
import NavigationBar from "./components/NavigationBar"
import TabContentManager from "./components/TabContentManager"
import TwoColumnLayout from "./components/TwoColumnLayout"
import { usePanelState } from "./hooks/usePanelState"
import { useFormAgentStore } from "./stores/formAgentStore"
import { getDefaultSettings, useFormStore } from "./stores/useFormStore"

function TestUIPageContent() {
  const {
    leftPanelWidth,
    isResizing,
    panelState,
    isFloating,
    setIsResizing,
    setPanelWidth,
  } = usePanelState()

  // Get authenticated user for API calls
  const { user, loading } = useAuth()
  const userId = user?.id || null

  // Router and search params for URL-based form ID management
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get formId from URL params or generate new one
  const formIdFromUrl = searchParams.get("formId")
  const [formId, setFormId] = useState(() => formIdFromUrl || uuidv4())

  // Update URL when formId changes
  useEffect(() => {
    if (!formIdFromUrl && formId) {
      // If no formId in URL, add it
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.set("formId", formId)
      router.replace(`/test-ui?${newSearchParams.toString()}`)
    } else if (formIdFromUrl && formIdFromUrl !== formId) {
      // If URL has different formId, use that
      setFormId(formIdFromUrl)
    }
  }, [formId, formIdFromUrl, router, searchParams])

  // Initialize agent connection for this form on mount
  useEffect(() => {
    console.log("[TestUIPage] Mounting with formId:", formId)
    const currentAgentState = useFormAgentStore.getState()
    console.log("[TestUIPage] Current agent store state:", {
      formId: currentAgentState.formId,
      hasCurrentForm: !!currentAgentState.currentForm,
      currentFormId: currentAgentState.currentForm?.id,
    })

    // Always initialize connection for the current form
    useFormAgentStore.getState().initializeConnection(formId)

    console.log(
      "[TestUIPage] After initializeConnection - initialized for formId:",
      formId
    )
  }, [formId])

  // Load existing form data on mount and set placeholder (mirrors FormPageClient pattern)
  useEffect(() => {
    const currentStoreForm = useFormStore.getState().form

    // If we're switching to a different form, reset and set placeholder immediately
    if (currentStoreForm && currentStoreForm.id !== formId) {
      console.log("[TestUIPage] Different form detected, resetting", {
        oldFormId: currentStoreForm.id,
        newFormId: formId,
      })

      // Reset form store when switching forms
      useFormStore.getState().resetForm()

      // Set placeholder form immediately to prevent showing old data
      const placeholderForm = {
        id: formId,
        version_id: uuidv4(),
        title: "Untitled Form",
        description: "",
        questions: [],
        settings: getDefaultSettings(),
        current_draft_version_id: null,
        current_published_version_id: null,
        short_id: undefined,
      }

      console.log("[TestUIPage] Setting placeholder form", {
        formId: placeholderForm.id,
      })
      useFormStore.getState().setForm(placeholderForm)
      return // Exit early since we've already set the form
    }

    // Load existing form data from API
    async function loadExistingFormData() {
      if (!formId) return

      try {
        console.log(
          "[TestUIPage] Attempting to load existing form data for:",
          formId
        )
        const response = await fetch(`/api/forms/${formId}`)

        if (response.ok) {
          const existingForm = await response.json()
          console.log("[TestUIPage] Loaded existing form data:", {
            formId: existingForm.id,
            title: existingForm.title,
            hasQuestions: existingForm.questions?.length > 0,
          })

          // Set form data in store
          if (!currentStoreForm || currentStoreForm.id !== existingForm.id) {
            useFormStore.getState().setForm(existingForm)
          }
        } else if (response.status === 404) {
          console.log(
            "[TestUIPage] Form not found in database - checking for agent data"
          )
          // Check if valid agent form data exists before creating placeholder
          const agentForm = useFormAgentStore.getState().currentForm
          const hasValidAgentData =
            agentForm && agentForm.id === formId && agentForm.version_id

          if (
            !hasValidAgentData &&
            (!currentStoreForm || currentStoreForm.id !== formId)
          ) {
            const newPlaceholderForm = {
              id: formId,
              version_id: uuidv4(),
              title: "Untitled Form",
              description: "",
              questions: [],
              settings: getDefaultSettings(),
              current_draft_version_id: null,
              current_published_version_id: null,
              short_id: undefined,
            }

            console.log(
              "[TestUIPage] Creating new placeholder form (no agent data)",
              {
                formId: newPlaceholderForm.id,
              }
            )
            useFormStore.getState().setForm(newPlaceholderForm)
          } else if (hasValidAgentData) {
            console.log(
              "[TestUIPage] Skipping placeholder creation - valid agent data exists"
            )
          }
        } else {
          console.error(
            "[TestUIPage] Error loading form data:",
            response.status,
            response.statusText
          )
          // Try to get more error details from the response
          try {
            const errorData = await response.json()
            console.error("[TestUIPage] Error details:", errorData)
          } catch (e) {
            console.error("[TestUIPage] Could not parse error response")
          }
        }
      } catch (error) {
        console.error("[TestUIPage] Failed to load existing form:", error)
        // Check if valid agent form data exists before creating placeholder
        const agentForm = useFormAgentStore.getState().currentForm
        const hasValidAgentData =
          agentForm && agentForm.id === formId && agentForm.version_id

        if (
          !hasValidAgentData &&
          (!currentStoreForm || currentStoreForm.id !== formId)
        ) {
          const errorPlaceholderForm = {
            id: formId,
            version_id: uuidv4(),
            title: "Untitled Form",
            description: "",
            questions: [],
            settings: getDefaultSettings(),
            current_draft_version_id: null,
            current_published_version_id: null,
            short_id: undefined,
          }

          console.log(
            "[TestUIPage] Creating error placeholder form (no agent data)",
            {
              formId: errorPlaceholderForm.id,
            }
          )
          useFormStore.getState().setForm(errorPlaceholderForm)
        } else if (hasValidAgentData) {
          console.log(
            "[TestUIPage] Skipping error placeholder creation - valid agent data exists"
          )
        }
      }
    }

    loadExistingFormData()
  }, [formId])

  // Subscribe to the agent store for the current form - BRIDGE PATTERN
  const formAgent_currentForm = useFormAgentStore((state) =>
    state.currentForm?.id === formId ? state.currentForm : null
  )

  // Bridge agent form updates to the form store (mirrors FormPageClient pattern)
  useEffect(() => {
    console.log("[TestUIPage] Agent form update effect triggered", {
      hasAgentForm: !!formAgent_currentForm,
      agentFormId: formAgent_currentForm?.id,
      formId: formId,
      idsMatch: formAgent_currentForm?.id === formId,
    })

    if (formAgent_currentForm) {
      const currentFormInStore = useFormStore.getState().form

      console.log("[TestUIPage] Current form store state:", {
        formId: currentFormInStore?.id,
        title: currentFormInStore?.title,
      })

      // Bridge the agent form to the form store - same pattern as FormPageClient
      const newFormForStore = {
        // Core fields from the agent's Form object
        id: formAgent_currentForm.id,
        version_id: formAgent_currentForm.version_id,
        title: formAgent_currentForm.title,
        description: formAgent_currentForm.description,
        questions: formAgent_currentForm.questions,
        settings: formAgent_currentForm.settings,
        short_id:
          formAgent_currentForm.short_id || currentFormInStore?.short_id,

        // Update draft version ID, preserve published ID
        current_draft_version_id: formAgent_currentForm.version_id,
        current_published_version_id:
          currentFormInStore?.current_published_version_id || null,
      }

      // Basic change detection to avoid unnecessary re-renders
      if (
        currentFormInStore?.version_id !== newFormForStore.version_id ||
        JSON.stringify(currentFormInStore?.questions) !==
          JSON.stringify(newFormForStore.questions) ||
        currentFormInStore?.title !== newFormForStore.title ||
        currentFormInStore?.description !== newFormForStore.description ||
        JSON.stringify(currentFormInStore?.settings) !==
          JSON.stringify(newFormForStore.settings)
      ) {
        console.log(
          "[TestUIPage] Syncing agent form to store:",
          newFormForStore
        )
        useFormStore.getState().setForm(newFormForStore as any)
      }
    }
  }, [formAgent_currentForm, formId])

  // Function to start new form creation
  const handleStartNewForm = () => {
    const newFormId = uuidv4()
    console.log("[TestUIPage] Starting new form creation with ID:", newFormId)

    // Update URL with new form ID
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.set("formId", newFormId)
    router.push(`/test-ui?${newSearchParams.toString()}`)

    // State will update via useEffect when URL changes
  }

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const handleResizeStart = () => {
    setIsResizing(true)
  }

  const handleResize = (width: number) => {
    setPanelWidth(width)
  }

  const handleResizeEnd = () => {
    setIsResizing(false)
  }

  const handleSaveForm = () => {
    console.log("Form saved!")
  }

  const handlePublishForm = () => {
    console.log("Form published!")
  }

  // Chat and design content - pass authentication data and form ID
  const chatContent = <ChatTabContent userId={userId} formId={formId} />
  const designContent = <DesignTabContent />

  // Left panel content
  const leftPanel = (
    <ChatDesignPanel chatContent={chatContent} designContent={designContent} />
  )

  // Right panel content - pass form ID and new form handler to TabContentManager
  const rightPanel = (
    <div className="flex h-full flex-col">
      <NavigationBar
        formId={formId}
        onSaveForm={handleSaveForm}
        onPublishForm={handlePublishForm}
      />
      <TabContentManager formId={formId} />
    </div>
  )

  return (
    <div className="relative">
      {/* Main Layout */}
      <TwoColumnLayout
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        leftPanelWidth={leftPanelWidth}
        isResizing={isResizing}
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
        panelState={panelState}
      />

      {/* Floating Panel */}
      {isFloating && (
        <FloatingPanel>
          {({ onHeaderMouseDown }) => (
            <ChatDesignPanel
              chatContent={<ChatTabContent userId={userId} formId={formId} />}
              designContent={designContent}
              onHeaderMouseDown={onHeaderMouseDown}
            />
          )}
        </FloatingPanel>
      )}
    </div>
  )
}

export default function TestUIPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <TestUIPageContent />
    </Suspense>
  )
}
