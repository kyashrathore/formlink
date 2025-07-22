"use client"

import FormlinkLogo from "@/app/components/FormlinkLogo"
import UserMenu from "@/app/components/layout/user-menu"
import { useAuth } from "@/app/hooks/useAuth"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
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

  // Memoize user data for UserMenu
  const userData = useMemo(() => {
    if (!user) return null
    return {
      id: user.id,
      email: user.email || "",
      display_name: user.user_metadata.name || null,
      profile_image: user.user_metadata.avatar_url || null,
      created_at: user.created_at || null,
      anonymous: false,
      daily_message_count: null,
      daily_reset: null,
      message_count: null,
      preferred_model: null,
      premium: null,
    }
  }, [user])

  // Router and URL params for form ID management
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()

  // Get formId from URL path params
  const formIdFromUrl = params.formId as string
  const [formId, setFormId] = useState(() => formIdFromUrl || uuidv4())

  // Handle shadcn CSS application
  const [shadcnStatus, setShadcnStatus] = useState<{
    loading: boolean
    error?: string
    success?: boolean
    appliedRootVariables?: string[]
    appliedDarkVariables?: string[]
    warnings?: string[]
  }>({ loading: false })

  // Shadcn CSS data for prop-based message sending
  const [shadcnCSSData, setShadcnCSSData] = useState<{
    cssText: string
    version: number
  } | null>(null)

  const handleShadcnCSSApply = useCallback((cssText: string) => {
    setShadcnStatus({ loading: true })

    // Trigger message sending by updating shadcnCSSData prop
    // The FormPreview component will send the message using its iframeRef
    setShadcnCSSData({
      cssText,
      version: Date.now(), // Use timestamp as version for uniqueness
    })
  }, [])

  const handleShadcnApplied = useCallback(
    (result: {
      success: boolean
      error?: string
      appliedRootVariables: string[]
      appliedDarkVariables: string[]
      warnings?: string[]
    }) => {
      setShadcnStatus({
        loading: false,
        error: result.error,
        success: result.success,
        appliedRootVariables: result.appliedRootVariables,
        appliedDarkVariables: result.appliedDarkVariables,
        warnings: result.warnings || [],
      })

      if (result.error) {
        console.error("Shadcn CSS application failed:", result.error)
      }
    },
    []
  )

  // Update URL when formId changes
  useEffect(() => {
    if (!formIdFromUrl && formId) {
      // If no formId in URL, navigate to form route
      router.replace(`/dashboard/forms/${formId}`)
    } else if (formIdFromUrl && formIdFromUrl !== formId) {
      // If URL has different formId, use that
      setFormId(formIdFromUrl)
    }
  }, [formId, formIdFromUrl, router])

  // Initialize agent connection for this form on mount
  useEffect(() => {
    // Always initialize connection for the current form
    useFormAgentStore.getState().initializeConnection(formId)
  }, [formId])

  // Load existing form data on mount and set placeholder (mirrors FormPageClient pattern)
  useEffect(() => {
    const currentStoreForm = useFormStore.getState().form

    // Always set placeholder form IMMEDIATELY for instant UI rendering
    // This prevents the "fucking lot of time" loading issue
    if (!currentStoreForm || currentStoreForm.id !== formId) {
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

      useFormStore.getState().setForm(placeholderForm)
    }

    // If we're switching to a different form, reset first
    if (currentStoreForm && currentStoreForm.id !== formId) {
      useFormStore.getState().resetForm()
    }

    // Load existing form data from API (NON-BLOCKING - happens in background)
    async function loadExistingFormData() {
      if (!formId) return

      try {
        const response = await fetch(`/api/forms/${formId}`)

        if (response.ok) {
          const existingForm = await response.json()

          // Set form data in store
          if (!currentStoreForm || currentStoreForm.id !== existingForm.id) {
            useFormStore.getState().setForm(existingForm)
          }
        } else if (response.status === 404) {
          // 404 is fine - placeholder is already set, agent will populate it
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
        // Error is fine - placeholder is already set, agent will populate it
      }
    }

    // Call asynchronously to prevent blocking page render
    setTimeout(() => loadExistingFormData(), 0)
  }, [formId])

  // Subscribe to the agent store for the current form - BRIDGE PATTERN
  const formAgent_currentForm = useFormAgentStore((state) =>
    state.currentForm?.id === formId ? state.currentForm : null
  )

  // Bridge agent form updates to the form store (mirrors FormPageClient pattern)
  useEffect(() => {
    if (formAgent_currentForm) {
      const currentFormInStore = useFormStore.getState().form

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

      // Optimized change detection - avoid expensive JSON.stringify
      const hasChanges =
        currentFormInStore?.version_id !== newFormForStore.version_id ||
        currentFormInStore?.title !== newFormForStore.title ||
        currentFormInStore?.description !== newFormForStore.description ||
        currentFormInStore?.questions?.length !==
          newFormForStore.questions?.length

      if (hasChanges) {
        useFormStore.getState().setForm(newFormForStore as any)
      }
    }
  }, [formAgent_currentForm, formId])

  // Function to start new form creation
  const handleStartNewForm = () => {
    const newFormId = uuidv4()

    // Navigate to new form route
    router.push(`/dashboard/forms/${newFormId}`)

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
    // Form save logic would go here
  }

  const handlePublishForm = () => {
    // Form publish logic would go here
  }

  // Chat and design content - pass authentication data and form ID
  const chatContent = <ChatTabContent userId={userId} formId={formId} />
  const designContent = (
    <DesignTabContent
      formId={formId}
      onShadcnCSSApply={handleShadcnCSSApply}
      shadcnStatus={shadcnStatus}
    />
  )

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
      <TabContentManager
        formId={formId}
        shadcnCSSData={shadcnCSSData || undefined}
        onShadcnApplied={handleShadcnApplied}
      />
    </div>
  )

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between px-6">
        <Link
          href="/dashboard"
          className="text-foreground hover:text-primary flex items-center text-xl font-semibold transition-colors"
        >
          <FormlinkLogo /> Formlink
        </Link>
        {userData && <UserMenu user={userData} />}
      </div>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden">
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
      </div>

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
