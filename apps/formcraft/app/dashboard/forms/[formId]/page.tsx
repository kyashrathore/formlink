"use client"

import FormlinkLogo from "@/app/components/FormlinkLogo"
import UserMenu from "@/app/components/layout/user-menu"
import { useAuth } from "@/app/hooks/useAuth"
import { useFormAgentStore } from "@/app/stores/formAgentStore"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
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

  const formIdFromUrl = params.formId as string
  const [formId, setFormId] = useState(() => formIdFromUrl || uuidv4())

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
    setShadcnStatus({ loading: true })

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
    if (!formIdFromUrl && formId) {
      router.replace(`/dashboard/forms/${formId}`)
    } else if (formIdFromUrl && formIdFromUrl !== formId) {
      setFormId(formIdFromUrl)
    }
  }, [formId, formIdFromUrl, router])

  useEffect(() => {
    useFormAgentStore.getState().initializeConnection(formId)
  }, [formId])

  useEffect(() => {
    const currentStoreForm = useFormStore.getState().form

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

    if (currentStoreForm && currentStoreForm.id !== formId) {
      useFormStore.getState().resetForm()
    }

    async function loadExistingFormData() {
      if (!formId) return

      try {
        const response = await fetch(`/api/forms/${formId}`)

        if (response.ok) {
          const existingForm = await response.json()

          if (!currentStoreForm || currentStoreForm.id !== existingForm.id) {
            useFormStore.getState().setForm(existingForm)
          }
        } else if (response.status === 404) {
        } else {
          console.error(
            "[TestUIPage] Error loading form data:",
            response.status,
            response.statusText
          )

          try {
            const errorData = await response.json()
            console.error("[TestUIPage] Error details:", errorData)
          } catch (error) {
            console.error("[TestUIPage] Could not parse error response:", error)
          }
        }
      } catch (error) {
        console.error("[TestUIPage] Failed to load existing form:", error)
      }
    }

    setTimeout(() => loadExistingFormData(), 0)
  }, [formId])

  const formAgent_currentForm = useFormAgentStore((state) =>
    state.currentForm?.id === formId ? state.currentForm : null
  )

  useEffect(() => {
    if (formAgent_currentForm) {
      const currentFormInStore = useFormStore.getState().form

      const newFormForStore = {
        id: formAgent_currentForm.id,
        version_id: formAgent_currentForm.version_id,
        title: formAgent_currentForm.title,
        description: formAgent_currentForm.description,
        questions: formAgent_currentForm.questions,
        settings: formAgent_currentForm.settings,
        short_id:
          formAgent_currentForm.short_id || currentFormInStore?.short_id,

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
        useFormStore.getState().setForm(newFormForStore as any)
      }
    }
  }, [formAgent_currentForm, formId])

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

  const handleSaveForm = () => {}

  const handlePublishForm = () => {}

  const chatContent = <ChatTabContent userId={userId} formId={formId} />
  const designContent = (
    <DesignTabContent
      formId={formId}
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
      {}
      <div className="flex flex-shrink-0 items-center justify-between px-6">
        <Link
          href="/dashboard"
          className="text-foreground hover:text-primary flex items-center text-xl font-semibold transition-colors"
        >
          <FormlinkLogo /> Formlink
        </Link>
        {userData && <UserMenu user={userData} />}
      </div>

      {}
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

      {}
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
