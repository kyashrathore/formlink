"use client"

import { AuthSteps } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialogParts/AuthSteps"
import { finalizeSuggestion } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialogParts/helpers"
import { IncludedActionsList } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialogParts/IncludedActionsList"
import { ParamsConfigurator } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialogParts/ParamsConfigurator"
import { requiresParamsForSlug } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import { CURATED_ACTIONS } from "@/app/lib/actions/registry"
import {
  Button,
  ScopedDrawer,
  ScopedDrawerClose,
  ScopedDrawerContent,
  ScopedDrawerHeader,
  ScopedDrawerOverlay,
  ScopedDrawerPortal,
  ScopedDrawerTitle,
} from "@formlink/ui"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// Constants
const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 60_000
const HUBSPOT_CREATE_CONTACT_SLUG =
  "HUBSPOT_CREATE_CONTACT_OBJECT_WITH_PROPERTIES"
const HUBSPOT_CONTACT_KEYS = [
  "properties.email",
  "properties.firstname",
  "properties.lastname",
  "properties.phone",
  "properties.company",
] as const

export type ActionItem = {
  slug: string
  label: string
  provider: string
  toolkit?: string
  status: string
  configured: boolean
  configLabel?: string
  toolSlug?: string
  toolLabel?: string
  uiStatus?: "ready" | "needs_auth" | "needs_setup"
}

export type SetupDrawerProps = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  openSlug: string | null
  setOpenSlug: (slug: string | null) => void
  actionItems: ActionItem[]
  formId?: string
  activeView: any | null
  refreshTools: () => void
  refreshConfigs?: () => void
  configs?: Array<{ toolSlug: string; config?: Record<string, unknown> }>
  setAuthingSlug: (slug: string | null) => void
  onSaveParams?: (
    slug: string,
    params: Record<string, unknown>
  ) => Promise<void> | void
}

// Helper functions (same as before)
function getToolkitFromItem(item: ActionItem | null): string {
  if (!item) return ""
  return (item.toolkit || item.slug.split(".")[0] || "").toLowerCase()
}

function getIncludedActionsForCurrent(
  currentItem: ActionItem | null,
  actionItems: ActionItem[]
): ActionItem[] {
  if (!currentItem) return []
  const tk = (
    currentItem.toolkit ||
    currentItem.slug.split("_")[0] ||
    ""
  ).toLowerCase()
  const related = actionItems.filter(
    (it) => (it.toolkit || "").toLowerCase() === tk
  )
  return related.length ? related : [currentItem]
}

function curatedFallbackKeys(slug: string | null): string[] {
  if (!slug) return []
  const ca = CURATED_ACTIONS.find((a) => a.slug === slug)
  const rp = (ca as any)?.requiredParams
  if (!rp || typeof rp !== "object") return []
  if (slug === HUBSPOT_CREATE_CONTACT_SLUG) return [...HUBSPOT_CONTACT_KEYS]
  return Object.keys(rp)
}

function extractKeysFromSchemaJson(slug: string | null, schema: any): string[] {
  const keys: string[] = []
  const props = schema?.properties || schema?.input?.properties || null
  const required: string[] = Array.isArray(schema?.required)
    ? schema.required
    : Array.isArray(schema?.input?.required)
      ? schema.input.required
      : []
  if (props && typeof props === "object") {
    for (const k of required) {
      const p = (props as any)[k]
      if (!p) continue
      if (p?.enum || ["string", "number", "boolean"].includes(p?.type)) {
        keys.push(k)
      } else if (k === "properties" && p?.type === "object" && p?.properties) {
        const nestedProps = p.properties as any
        const nestedReq: string[] = Array.isArray(p.required)
          ? p.required
          : Object.keys(nestedProps)
        for (const nk of nestedReq) {
          const np = nestedProps[nk]
          if (!np) continue
          if (np?.enum || ["string", "number", "boolean"].includes(np?.type)) {
            keys.push(`${k}.${nk}`)
          }
        }
      }
    }
    if (!keys.length) {
      for (const [k, p] of Object.entries<any>(props)) {
        if (k === "properties" && p?.type === "object" && p?.properties) {
          for (const [nk, np] of Object.entries<any>(p.properties)) {
            if ((np as any)?.enum || (np as any)?.type === "string")
              keys.push(`${k}.${nk}`)
          }
        } else if ((p as any)?.enum || (p as any)?.type === "string") {
          keys.push(k)
        }
      }
    }
  }
  // Ensure curated keys are present and clamp if schema is noisy
  const curated = curatedFallbackKeys(slug)
  if (curated.length) {
    if (!keys.length || keys.length > curated.length + 5) {
      keys.length = 0
      for (const ck of curated) keys.push(ck)
    }
    for (const ck of curated) if (!keys.includes(ck)) keys.push(ck)
  }
  return keys
}

function shouldFetchSchema(
  item: ActionItem | null,
  authReady: boolean,
  needsSetupFromServer: boolean,
  openSlug: string | null
): boolean {
  return Boolean(
    item &&
      item.provider === "composio" &&
      (authReady || needsSetupFromServer) &&
      openSlug
  )
}

export function SetupDrawer(props: SetupDrawerProps) {
  const {
    open,
    onOpenChange,
    openSlug,
    setOpenSlug,
    actionItems,
    formId,
    activeView,
    refreshTools,
    setAuthingSlug,
    onSaveParams,
  } = props

  const [connectStage, setConnectStage] = useState<
    "idle" | "generating" | "awaiting_user" | "verifying" | "done" | "error"
  >("idle")
  const [connectError, setConnectError] = useState<string | null>(null)
  const [pollingSlug, setPollingSlug] = useState<string | null>(null)
  const [lastAuthLinkByToolkit, setLastAuthLinkByToolkit] = useState<
    Record<string, string>
  >({})

  const [savingConfig, setSavingConfig] = useState(false)
  const [paramsDrafts, setParamsDrafts] = useState<
    Record<string, Record<string, unknown>>
  >({})
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [suggestRationale, setSuggestRationale] = useState<string | null>(null)
  const autoSuggestedRef = useRef<Set<string>>(new Set())

  const pollRefresh = useCallback(() => {
    refreshTools()
  }, [refreshTools])

  useEffect(() => {
    if (!pollingSlug) return
    const interval = setInterval(pollRefresh, POLL_INTERVAL_MS)
    const timeout = setTimeout(() => setPollingSlug(null), POLL_TIMEOUT_MS)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [pollingSlug, pollRefresh])

  const currentItem = useMemo(() => {
    return actionItems.find((i) => i.slug === openSlug) || null
  }, [openSlug, actionItems])

  const includedActionsForCurrent = useMemo(
    () => getIncludedActionsForCurrent(currentItem, actionItems),
    [currentItem, actionItems]
  )

  const derivedToolkit = useMemo(
    () => getToolkitFromItem(currentItem),
    [currentItem]
  )

  const redirectAuthLink = lastAuthLinkByToolkit[derivedToolkit]
  const currentAuthReady = useMemo(() => {
    if (!currentItem) return false
    const s = String(currentItem.status || "").toLowerCase()
    return s === "ready" || s === "connected"
  }, [currentItem])

  const needsSetupFromServer = useMemo(() => {
    return Boolean(currentItem && currentItem.uiStatus === "needs_setup")
  }, [currentItem])

  const needsParamsBySlug = useMemo(() => {
    return Boolean(currentItem && requiresParamsForSlug(currentItem.slug))
  }, [currentItem])

  const questionsQuery = useQuery<{ id: string; label: string }[]>({
    queryKey: ["form-questions", formId, openSlug],
    enabled: Boolean(formId && openSlug),
    queryFn: async () => {
      const res = await fetch(`/api/forms/${formId}/questions`)
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Failed to load questions (${res.status})`)
      }
      const json = (await res.json()) as {
        success: boolean
        questions?: { id: string; label: string }[]
      }
      return json.questions || []
    },
  })

  const shouldSchema = shouldFetchSchema(
    currentItem,
    currentAuthReady,
    needsSetupFromServer,
    openSlug
  )

  const schemaQuery = useQuery<string[]>({
    queryKey: ["action-schema-keys", openSlug, shouldSchema],
    enabled: Boolean(shouldSchema && openSlug),
    queryFn: async () => {
      const res = await fetch(
        `/api/actions/schema?slug=${encodeURIComponent(openSlug as string)}`
      )
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Failed to load schema (${res.status})`)
      }
      const json = (await res.json()) as { success: boolean; schema?: any }
      const schema = json.schema || null
      const keys = extractKeysFromSchemaJson(openSlug, schema)
      return keys.length ? keys : curatedFallbackKeys(openSlug)
    },
    retry: 1,
  })

  const schemaKeys = schemaQuery.data || []
  const schemaLoading = schemaQuery.isPending
  const schemaError = schemaQuery.error
    ? schemaQuery.error instanceof Error
      ? schemaQuery.error.message
      : String(schemaQuery.error)
    : null
  const questions = questionsQuery.data || []

  const autoSuggest = useCallback(
    async (keyPrefix: "initial" | "auth") => {
      if (!formId || !currentItem) return
      const needs = needsParamsBySlug || needsSetupFromServer
      if (!needs || currentItem.configured) return
      const key = `${keyPrefix}:${currentItem.slug}`
      if (autoSuggestedRef.current.has(key)) return
      setSuggestLoading(true)
      setSuggestError(null)
      setSuggestRationale(null)
      try {
        const res = await fetch(`/api/actions/schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ formId, slug: currentItem.slug }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !(json as any)?.success) {
          throw new Error(
            (json as any)?.error || `Suggestion failed (${res.status})`
          )
        }
        const raw = ((json as any)?.suggestion?.params || {}) as Record<
          string,
          unknown
        >
        const next = finalizeSuggestion(currentItem.slug, raw, questions)
        setParamsDrafts((prev) => ({
          ...prev,
          [currentItem.slug]: {
            ...(prev[currentItem.slug] || {}),
            ...(next || {}),
          },
        }))
        if ((json as any)?.suggestion?.rationale)
          setSuggestRationale(String((json as any).suggestion.rationale))
        autoSuggestedRef.current.add(key)
      } catch (e) {
        setSuggestError(e instanceof Error ? e.message : String(e))
      } finally {
        setSuggestLoading(false)
      }
    },
    [formId, currentItem, needsParamsBySlug, needsSetupFromServer, questions]
  )

  useEffect(() => {
    if (!openSlug) return
    const item = actionItems.find((i) => i.slug === openSlug)
    if (!item) return
    const s = String(item.status || "").toLowerCase()
    if (s === "ready" || s === "connected") {
      setConnectStage("done")
      setPollingSlug(null)
    }
  }, [actionItems, openSlug])

  useEffect(() => {
    setSuggestRationale(null)
    setSuggestError(null)
    setSuggestLoading(false)
  }, [openSlug])

  useEffect(() => {
    void autoSuggest("initial")
  }, [autoSuggest])

  useEffect(() => {
    if (!currentAuthReady) return
    void autoSuggest("auth")
  }, [autoSuggest, currentAuthReady])

  // Adaptive Portal/Modal Logic
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )

  // Checking for window/document to ensure SSR safety
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.getElementById("right-panel-root")
      setPortalContainer(root || document.body)
    }
  }, [])

  // If we found the specific right-panel-root, we are in "Scoped" mode (modeless).
  // Otherwise, we are likely in "Global" mode (modal).
  const isScoped = portalContainer?.id === "right-panel-root"

  return (
    <ScopedDrawer
      open={open}
      modal={!isScoped} // User requested modeless only when scoped
      onOpenChange={(openState: boolean) => {
        onOpenChange?.(openState)
        if (!openState) setOpenSlug(null)
      }}
    >
      <ScopedDrawerPortal container={portalContainer}>
        <ScopedDrawerOverlay />
        <ScopedDrawerContent className="p-0 sm:max-w-[460px]">
          <ScopedDrawerHeader className="bg-background sticky top-0 z-10 border-b px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <ScopedDrawerTitle className="text-base font-semibold">
                  {currentItem ? `Setup ${currentItem.label}` : "Setup action"}
                </ScopedDrawerTitle>
                <p className="text-muted-foreground text-xs">
                  Connect the integration and set required parameters.
                </p>
              </div>
              <ScopedDrawerClose asChild>
                <Button size="icon" variant="ghost" aria-label="Close setup">
                  ×
                </Button>
              </ScopedDrawerClose>
            </div>
          </ScopedDrawerHeader>

          <div className="h-[calc(100%-48px)] overflow-y-auto px-4 pt-3 pb-4">
            {currentItem ? (
              <div className="space-y-3">
                <IncludedActionsList
                  currentItem={currentItem}
                  includedActionsForCurrent={includedActionsForCurrent}
                />

                <AuthSteps
                  currentItem={currentItem}
                  currentAuthReady={currentAuthReady}
                  redirectAuthLink={redirectAuthLink}
                  connectStage={connectStage}
                  setConnectStage={setConnectStage}
                  connectError={connectError}
                  setConnectError={setConnectError}
                  formId={formId}
                  derivedToolkit={derivedToolkit}
                  setLastAuthLinkByToolkit={setLastAuthLinkByToolkit}
                  setPollingSlug={setPollingSlug}
                  refreshTools={refreshTools}
                  setAuthingSlug={setAuthingSlug}
                />

                {(needsParamsBySlug || needsSetupFromServer) &&
                !currentItem.configured &&
                (currentItem.provider !== "composio" ||
                  currentAuthReady ||
                  needsSetupFromServer) ? (
                  <ParamsConfigurator
                    formId={formId}
                    currentItem={currentItem}
                    schemaKeys={schemaKeys}
                    schemaLoading={schemaLoading}
                    schemaError={schemaError}
                    suggestLoading={suggestLoading}
                    suggestError={suggestError}
                    suggestRationale={suggestRationale}
                    setSuggestLoading={setSuggestLoading}
                    setSuggestError={setSuggestError}
                    setSuggestRationale={setSuggestRationale}
                    paramsDrafts={paramsDrafts}
                    setParamsDrafts={setParamsDrafts}
                    questions={questions}
                    activeView={activeView}
                    refreshTools={refreshTools}
                    setOpenSlug={setOpenSlug}
                    savingConfig={savingConfig}
                    setSavingConfig={setSavingConfig}
                    onSaveParams={onSaveParams}
                  />
                ) : null}

                {currentItem.provider === "usesend" ? (
                  <div className="text-muted-foreground text-sm">
                    This action does not require connection or defaults.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </ScopedDrawerContent>
      </ScopedDrawerPortal>
    </ScopedDrawer>
  )
}
