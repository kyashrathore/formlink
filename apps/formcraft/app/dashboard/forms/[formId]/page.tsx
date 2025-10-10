"use client"

import { useAuth } from "@/app/hooks/useAuth"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import ChatDesignPanel from "./components/ChatDesignPanel"
import ChatTabContent from "./components/ChatTabContent"
import DesignTabContent from "./components/DesignTabContent"
import FloatingPanel from "./components/FloatingPanel"
import NavigationBar from "./components/NavigationBar"
import TabContentManager from "./components/TabContentManager"
import TwoColumnLayout from "./components/TwoColumnLayout"
import { useFormDataQuery } from "./hooks/useFormDataQuery"
import { usePanelState } from "./hooks/usePanelState"
import { useFormEditorStore } from "./stores/useFormEditorStore"
import { useFormGenerationStore } from "./stores/useFormGenerationStore"

function TestUIPageContent() {
  const {
    leftPanelWidth,
    isResizing,
    panelState,
    isFloating,
    setIsResizing,
    setPanelWidth,
  } = usePanelState()

  const { user, loading } = useAuth()
  const userId = user?.id || null

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

  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const storeInitialModel = useFormGenerationStore((s) => s.initialModel)
  const initialModel =
    storeInitialModel ||
    useMemo(() => searchParams.get("model") || undefined, [searchParams])

  const formIdFromUrl = params.formId as string
  // Defer formId creation - only use real IDs, not sentinels like "new"
  const formId =
    formIdFromUrl && formIdFromUrl !== "new" ? formIdFromUrl : undefined

  const {
    data: formData,
    isLoading: formQueryLoading,
    isSuccess,
  } = useFormDataQuery(formId)
  const { setForm, setLoading } = useFormEditorStore((s) => ({
    setForm: s.setForm,
    setLoading: s.setLoading,
  }))
  const formSetRef = useRef(false)

  const [shadcnStatus, setShadcnStatus] = useState<{
    loading: boolean
    error?: string
    success?: boolean
    appliedRootVariables?: string[]
    appliedDarkVariables?: string[]
    warnings?: string[]
  }>({ loading: false })

  const [shadcnCSSData, setShadcnCSSData] = useState<{
    cssText: string
    version: number
  } | null>(null)

  const handleShadcnCSSApply = useCallback((cssText: string) => {
    // Optimistically mark not loading so the editor buttons don't get stuck
    setShadcnStatus({ loading: false })
    setShadcnCSSData({
      cssText,
      version: Date.now(),
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

  useEffect(() => {
    if (isSuccess && formData && !formSetRef.current) {
      setForm(formData)
      formSetRef.current = true
      setLoading(false)
    }
  }, [isSuccess, formData, setForm, setLoading])

  const formAgent_currentForm = useFormGenerationStore(
    (state) => state.currentForm
  )

  // Maintain isLoading=true until either query success OR form-generation provides snapshot
  useEffect(() => {
    const hasFormFromQuery = isSuccess && formData
    const hasFormFromGeneration = Boolean(formAgent_currentForm)
    const hasAnyForm = hasFormFromQuery || hasFormFromGeneration

    // Show loading if:
    // 1. We have a formId and query is loading (existing form case)
    // 2. We don't have any form data yet (new form case - show until generation starts)
    const shouldBeLoading = (formId && formQueryLoading) || !hasAnyForm

    setLoading(shouldBeLoading)
  }, [
    formId,
    formQueryLoading,
    isSuccess,
    formData,
    formAgent_currentForm,
    setLoading,
  ])

  // Read initial prompt and model from URL query parameters
  useEffect(() => {
    const initialPromptFromUrl = searchParams.get("initialPrompt")
    const initialModelFromUrl = searchParams.get("model")
    if (initialPromptFromUrl) {
      const decodedPrompt = decodeURIComponent(initialPromptFromUrl)
      useFormGenerationStore.getState().setInitialPrompt(decodedPrompt)

      // Clean up the URL by removing the query parameter
      const newUrl = window.location.pathname
      window.history.replaceState({}, "", newUrl)
    }
    if (initialModelFromUrl) {
      // Persist initial model in store to survive StrictMode remounts
      useFormGenerationStore.getState().setInitialModel(initialModelFromUrl)
      // Cleanup already handled above by replacing to pathname when prompt present
    }
  }, [searchParams])

  useEffect(() => {
    if (formId) {
      useFormGenerationStore.getState().initializeConnection(formId)
    }
  }, [formId])

  useEffect(() => {
    if (formAgent_currentForm) {
      // Handle router replacement when form is created
      if (!formId && formAgent_currentForm.id) {
        router.replace(`/dashboard/forms/${formAgent_currentForm.id}`)
        return
      }

      // Only process if this is our form
      if (formAgent_currentForm.id === formId) {
        const currentFormInStore = useFormEditorStore.getState().form

        const newFormForStore = {
          id: formAgent_currentForm.id,
          version_id: formAgent_currentForm.version_id,
          title: formAgent_currentForm.title,
          description: formAgent_currentForm.description,
          questions: formAgent_currentForm.questions,
          settings: formAgent_currentForm.settings,
          short_id:
            formAgent_currentForm.short_id ||
            currentFormInStore?.short_id ||
            formData?.short_id,

          current_draft_version_id: formAgent_currentForm.version_id,
          current_published_version_id:
            currentFormInStore?.current_published_version_id || null,
        }

        const hasChanges =
          currentFormInStore?.version_id !== newFormForStore.version_id ||
          currentFormInStore?.title !== newFormForStore.title ||
          currentFormInStore?.description !== newFormForStore.description ||
          currentFormInStore?.questions?.length !==
            newFormForStore.questions?.length

        if (hasChanges) {
          useFormEditorStore.getState().setForm(newFormForStore as any)
          useFormEditorStore.getState().setLoading(false)
        }
      }
    }
  }, [formAgent_currentForm, formId, router])

  // Reset tab states when form page unmounts to ensure clean state for next form
  useEffect(() => {
    return () => {
      usePanelState.getState().resetToDefaults()
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--header-height,var(--spacing-app-header,56px)))] items-center justify-center">
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

  const handleSaveForm = () => {}

  const handlePublishForm = () => {}

  const chatContent = (
    <ChatTabContent
      userId={userId}
      formId={formId || ""}
      initialModel={initialModel}
    />
  )
  const designContent = (
    <DesignTabContent
      formId={formId || ""}
      onShadcnCSSApply={handleShadcnCSSApply}
      shadcnStatus={shadcnStatus}
    />
  )

  const leftPanel = (
    <ChatDesignPanel chatContent={chatContent} designContent={designContent} />
  )

  const rightPanel = (
    <div className="flex h-full flex-col">
      <NavigationBar
        formId={formId || ""}
        onSaveForm={handleSaveForm}
        onPublishForm={handlePublishForm}
      />
      <TabContentManager
        formId={formId || ""}
        shadcnCSSData={shadcnCSSData || undefined}
        onShadcnApplied={handleShadcnApplied}
      />
    </div>
  )

  return (
    <div className="flex h-[calc(100dvh-var(--header-height,var(--spacing-app-header,56px)))] flex-col overflow-hidden">
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

      {isFloating && (
        <FloatingPanel>
          {({ onHeaderMouseDown }) => (
            <ChatDesignPanel
              chatContent={
                <ChatTabContent
                  userId={userId}
                  formId={formId || ""}
                  initialModel={initialModel}
                />
              }
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
        <div className="flex min-h-[calc(100dvh-var(--header-height,var(--spacing-app-header,56px)))] items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <TestUIPageContent />
    </Suspense>
  )
}
