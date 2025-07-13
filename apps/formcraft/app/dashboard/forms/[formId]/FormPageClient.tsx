"use client"

import { useWarnIfUnsavedChanges } from "@/app/hooks/useWarnIfUnsavedChanges"
import logger from "@/app/lib/logger" // Import logger
import { useFormAgentStore } from "@/app/stores/formAgentStore"
import { User } from "@formlink/db"
import { Form } from "@formlink/schema" // Question might be unused now, can be cleaned later

import { motion } from "motion/react"
import React, { useEffect, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import FormEditorComponent from "./FormEditor/FormEditor"
import RealEmbedPreview from "./FormEditor/RealEmbedPreview"
import { getDefaultSettings, useFormStore } from "./FormEditor/useFormStore"
import FormPageHeader from "./Header"
import Responses from "./responses/Responses"
import Settings from "./settings"
import Sidebar from "./Sidebar"

type TabKey = "content" | "share" | "responses" | "settings"

type FormWithVersionIds = Form & {
  current_published_version_id?: string | null
  current_draft_version_id?: string | null
}

interface FormPageClientProps {
  initialDbForm: FormWithVersionIds | null
  formIdFromUrl: string
  user: User | null
}

interface RenderSectionContentProps {
  selectedTab: TabKey
  shortId: string
  user: User | null
  form: Form
}

const RenderSectionContent = ({
  selectedTab,
  shortId,
  user,
  form,
}: RenderSectionContentProps) => {
  switch (selectedTab) {
    case "content":
      return <FormEditorComponent user={user} selectedTab={selectedTab} />
    case "share":
      return <RealEmbedPreview shortId={shortId} />
    case "responses":
      return <Responses form={form} />
    case "settings":
      return <Settings form={form} userId={user?.id} />
    default:
      return null
  }
}

export default function FormPageClient({
  initialDbForm,
  formIdFromUrl,
  user,
}: FormPageClientProps) {
  useWarnIfUnsavedChanges()

  const { setForm, form, resetForm } = useFormStore()

  // Initialize agent connection for this form on mount
  useEffect(() => {
    console.log("[FormPageClient] Mounting with formId:", formIdFromUrl)
    const currentAgentState = useFormAgentStore.getState()
    console.log("[FormPageClient] Current agent store state:", {
      formId: currentAgentState.formId,
      hasCurrentForm: !!currentAgentState.currentForm,
      currentFormId: currentAgentState.currentForm?.id,
      hasJourneyScript:
        !!currentAgentState.currentForm?.settings?.journeyScript,
      journeyScriptPreview:
        currentAgentState.currentForm?.settings?.journeyScript?.substring(
          0,
          50
        ) + "...",
    })

    // Always initialize connection for the current form
    // This will properly clear any stale data if switching forms
    useFormAgentStore.getState().initializeConnection(formIdFromUrl)

    console.log("[FormPageClient] After initializeConnection:")
    const afterState = useFormAgentStore.getState()
    console.log({
      formId: afterState.formId,
      hasCurrentForm: !!afterState.currentForm,
      currentFormId: afterState.currentForm?.id,
      hasJourneyScript: !!afterState.currentForm?.settings?.journeyScript,
    })

    return () => {
      // Don't reset stores on unmount as it might affect navigation
    }
  }, [formIdFromUrl])

  useEffect(() => {
    const currentStoreForm = useFormStore.getState().form

    // If we're navigating to a different form, immediately set placeholder
    if (currentStoreForm && currentStoreForm.id !== formIdFromUrl) {
      console.log("[FormPageClient] Different form detected, resetting", {
        oldFormId: currentStoreForm.id,
        newFormId: formIdFromUrl,
        oldFormHasJourneyScript: !!currentStoreForm.settings?.journeyScript,
      })

      // Reset form store when switching forms
      resetForm() // Clear the form store completely

      // Immediately set a placeholder form to prevent showing old data
      const placeholderForm: FormWithVersionIds = {
        id: formIdFromUrl,
        version_id: uuidv4(),
        title: "Untitled Form",
        description: "",
        questions: [],
        settings: {
          ...getDefaultSettings(),
          journeyScript: undefined, // Explicitly clear journey script
          resultPageGenerationPrompt: undefined, // Clear result page prompt too
        },
        current_draft_version_id: null,
        current_published_version_id: null,
        short_id: undefined,
      }
      console.log("[FormPageClient] Setting placeholder form", {
        formId: placeholderForm.id,
        hasJourneyScript: !!placeholderForm.settings?.journeyScript,
      })
      setForm(placeholderForm)
      return // Exit early since we've already set the form
    }

    if (initialDbForm && initialDbForm.id) {
      // Setting form from DB
      if (!currentStoreForm || currentStoreForm.id !== initialDbForm.id) {
        setForm(initialDbForm)
      }
    } else if (!initialDbForm && formIdFromUrl) {
      if (!currentStoreForm || currentStoreForm.id !== formIdFromUrl) {
        console.log("[FormPageClient] Creating new placeholder form", {
          formId: formIdFromUrl,
          currentFormId: currentStoreForm?.id,
          currentFormHasJourneyScript:
            !!currentStoreForm?.settings?.journeyScript,
        })

        const newPlaceholderForm: FormWithVersionIds = {
          id: formIdFromUrl,
          version_id: uuidv4(),
          title: "Untitled Form",
          description: "",
          questions: [],
          settings: {
            ...getDefaultSettings(),
            journeyScript: undefined, // Explicitly clear journey script
            resultPageGenerationPrompt: undefined, // Clear result page prompt too
          },
          current_draft_version_id: null,
          current_published_version_id: null,
          short_id: undefined,
        }
        console.log("[FormPageClient] Placeholder form created", {
          hasJourneyScript: !!newPlaceholderForm.settings?.journeyScript,
          settings: newPlaceholderForm.settings,
        })
        // Creating placeholder form
        setForm(newPlaceholderForm)
      }
    }
  }, [initialDbForm, formIdFromUrl, setForm])

  // Subscribe to the agent store but only for the current form
  const formAgent_currentForm = useFormAgentStore((state) =>
    state.currentForm?.id === formIdFromUrl ? state.currentForm : null
  )
  const formAgent_agentStateFromStore = useFormAgentStore((state) =>
    state.currentForm?.id === formIdFromUrl ? state.agentState : null
  )

  useEffect(() => {
    console.log("[FormPageClient] Agent form update effect triggered", {
      hasAgentForm: !!formAgent_currentForm,
      agentFormId: formAgent_currentForm?.id,
      urlFormId: formIdFromUrl,
      idsMatch: formAgent_currentForm?.id === formIdFromUrl,
      hasJourneyScript: !!formAgent_currentForm?.settings?.journeyScript,
      journeyScriptPreview:
        formAgent_currentForm?.settings?.journeyScript?.substring(0, 50) +
        "...",
    })

    // This effect reacts to changes in the form data received from the agent
    // (via SSE and processed by useFormAgentStore, updating formAgent_currentForm)
    // The subscription already filters by form ID, so we just check if we have data
    if (formAgent_currentForm) {
      const currentFormInStore = useFormStore.getState()
        .form as FormWithVersionIds | null

      console.log("[FormPageClient] Current form store state:", {
        formId: currentFormInStore?.id,
        title: currentFormInStore?.title,
        hasJourneyScript: !!currentFormInStore?.settings?.journeyScript,
      })

      // Check if this is stale data - if the current form is a placeholder (no version from DB)
      // and the agent form has content, we should wait for fresh agent data
      const isPlaceholderForm =
        !currentFormInStore?.current_draft_version_id &&
        !currentFormInStore?.current_published_version_id &&
        currentFormInStore?.title === "Untitled Form"

      const hasAgentContent =
        formAgent_currentForm.questions.length > 0 ||
        formAgent_currentForm.settings?.journeyScript ||
        formAgent_currentForm.title !== "Untitled Form"

      console.log("[FormPageClient] Stale data check:", {
        isPlaceholderForm,
        hasAgentContent,
        willSkip: isPlaceholderForm && hasAgentContent,
      })

      // Don't apply agent data if we have a fresh placeholder and the agent data looks like old content
      if (isPlaceholderForm && hasAgentContent) {
        console.log("[FormPageClient] Skipping stale agent data for new form")
        return
      }

      // Agent form update received

      const newFormForStore: FormWithVersionIds = {
        // Core fields from the agent's Form object (formAgent_currentForm)
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

      // Basic change detection to avoid unnecessary re-renders or potential loops
      if (
        currentFormInStore?.version_id !== newFormForStore.version_id ||
        JSON.stringify(currentFormInStore?.questions) !==
          JSON.stringify(newFormForStore.questions) ||
        currentFormInStore?.title !== newFormForStore.title ||
        currentFormInStore?.description !== newFormForStore.description ||
        JSON.stringify(currentFormInStore?.settings) !==
          JSON.stringify(newFormForStore.settings)
      ) {
        setForm(newFormForStore)
      }
    }
  }, [formAgent_currentForm, formIdFromUrl, setForm])

  const [selectedTab, setSelectedTab] = useState<TabKey>("content")
  const handleTabChange = (tab: TabKey) => {
    setSelectedTab(tab)
  }

  if (!form) {
    return <div className="p-4 text-center">Loading form data...</div>
  }

  return (
    <motion.div
      className="isolate flex min-h-screen flex-col"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex h-screen max-h-screen overflow-hidden">
        <Sidebar
          selectedTab={selectedTab}
          onTabChange={handleTabChange}
          formId={form.id}
          shortId={form.short_id}
          form={form}
          user={user}
        />
        <main
          className="relative flex-1 overflow-y-auto scroll-smooth px-8 py-8"
          id="form-section-container"
        >
          <FormPageHeader title={form.title} formId={form.id} user={user} />
          <RenderSectionContent
            selectedTab={selectedTab}
            form={form}
            shortId={form.short_id as string}
            user={user}
          />
        </main>
      </div>
    </motion.div>
  )
}
