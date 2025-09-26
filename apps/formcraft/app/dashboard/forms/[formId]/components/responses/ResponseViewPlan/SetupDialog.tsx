"use client"

import { AuthSteps } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialogParts/AuthSteps"
import { finalizeSuggestion } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialogParts/helpers"
import { IncludedActionsList } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialogParts/IncludedActionsList"
import { ParamsConfigurator } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialogParts/ParamsConfigurator"
import { requiresParamsForSlug } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import { CURATED_ACTIONS } from "@/app/lib/actions/registry"
import { Button } from "@formlink/ui"
import React, { useEffect, useMemo, useState } from "react"
import { Drawer } from "vaul"

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

export function SetupDialog({
  openSlug,
  setOpenSlug,
  actionItems,
  formId,
  activeView,
  refreshTools,
  setAuthingSlug,
}: {
  openSlug: string | null
  setOpenSlug: (slug: string | null) => void
  actionItems: ActionItem[]
  formId?: string
  activeView: any | null
  refreshTools: () => void
  refreshConfigs: () => void
  configs: Array<{ toolSlug: string; config?: Record<string, unknown> }>
  setAuthingSlug: (slug: string | null) => void
}) {
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
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [schemaKeys, setSchemaKeys] = useState<string[]>([])
  const [questions, setQuestions] = useState<
    Array<{ id: string; label: string }>
  >([])
  const [, setQuestionsLoading] = useState(false)
  const [, setQuestionsError] = useState<string | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [suggestRationale, setSuggestRationale] = useState<string | null>(null)
  // Advanced JSON mapping was removed per product decision
  const autoSuggestedRef = React.useRef<Set<string>>(new Set())

  // Auto-suggest moved below after currentItem and derived flags are defined

  useEffect(() => {
    if (!pollingSlug) return
    const interval = setInterval(() => {
      refreshTools()
    }, 4000)
    const timeout = setTimeout(() => setPollingSlug(null), 60_000)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [pollingSlug, refreshTools])

  const currentItem = useMemo(() => {
    return actionItems.find((i) => i.slug === openSlug) || null
  }, [openSlug, actionItems])

  const includedActionsForCurrent = useMemo(() => {
    if (!currentItem) return [] as ActionItem[]
    const tk = (
      currentItem.toolkit ||
      currentItem.slug.split("_")[0] ||
      ""
    ).toLowerCase()
    const related = actionItems.filter(
      (it) => (it.toolkit || "").toLowerCase() === tk
    )
    return related.length ? related : [currentItem]
  }, [currentItem, actionItems])

  const derivedToolkit = useMemo(() => {
    if (!currentItem) return ""
    return (
      currentItem.toolkit ||
      currentItem.slug.split(".")[0] ||
      ""
    ).toLowerCase()
  }, [currentItem])

  const redirectAuthLink = lastAuthLinkByToolkit[derivedToolkit]
  const currentAuthReady = useMemo(() => {
    if (!currentItem) return false
    const s = String(currentItem.status || "").toLowerCase()
    return s === "ready" || s === "connected"
  }, [currentItem])

  // Silence unused props that may still be passed by callers
  // (Keep types stable without surfacing lint errors)

  // Server may signal post-auth setup even if curated action has no requiredParams
  const needsSetupFromServer = useMemo(() => {
    return Boolean(currentItem && currentItem.uiStatus === "needs_setup")
  }, [currentItem])

  const needsParamsBySlug = useMemo(() => {
    return Boolean(currentItem && requiresParamsForSlug(currentItem.slug))
  }, [currentItem])

  // No generic JSON editor; configs are captured via params drafts

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

  // Reset suggest state when switching actions
  useEffect(() => {
    setSuggestRationale(null)
    setSuggestError(null)
    setSuggestLoading(false)
  }, [openSlug])

  // Auto-suggest params on dialog open if needs setup
  useEffect(() => {
    const doAutoSuggest = async () => {
      if (!formId || !currentItem) return
      const needs = needsParamsBySlug || needsSetupFromServer
      if (!needs || currentItem.configured) return
      const key = `initial:${currentItem.slug}`
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
    }
    doAutoSuggest()
  }, [formId, currentItem, needsParamsBySlug, needsSetupFromServer])

  // Auto-suggest again once auth becomes ready (post-OAuth)
  useEffect(() => {
    const doAutoSuggest = async () => {
      if (!formId || !currentItem || !currentAuthReady) return
      const needs = needsParamsBySlug || needsSetupFromServer
      if (!needs || currentItem.configured) return
      const key = `auth:${currentItem.slug}`
      if (autoSuggestedRef.current.has(key)) return
      setSuggestLoading(true)
      setSuggestError(null)
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
    }
    doAutoSuggest()
  }, [
    formId,
    currentItem,
    currentAuthReady,
    needsParamsBySlug,
    needsSetupFromServer,
  ])

  // Fetch provider schema after auth ready (or when server flags needs_setup) and render suggested fields; fallback to curated keys
  useEffect(() => {
    const shouldFetch = Boolean(
      currentItem &&
        currentItem.provider === "composio" &&
        (currentAuthReady || needsSetupFromServer) &&
        openSlug
    )
    if (!shouldFetch) {
      setSchemaKeys([])
      setSchemaError(null)
      setSchemaLoading(false)
      return
    }
    let cancelled = false
    setSchemaLoading(true)
    setSchemaError(null)
    fetch(`/api/actions/schema?slug=${encodeURIComponent(openSlug!)}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "")
          throw new Error(text || `Failed to load schema (${res.status})`)
        }
        return res.json() as Promise<{ success: boolean; schema?: any }>
      })
      .then((json) => {
        if (cancelled) return
        const schema = json.schema || null
        const keys: string[] = []
        try {
          const props = schema?.properties || schema?.input?.properties || null
          const required: string[] = Array.isArray(schema?.required)
            ? schema.required
            : Array.isArray(schema?.input?.required)
              ? schema.input.required
              : []
          if (props && typeof props === "object") {
            // Prefer required top-level primitives
            for (const k of required) {
              const p = (props as any)[k]
              if (!p) continue
              if (
                p?.enum ||
                p?.type === "string" ||
                p?.type === "number" ||
                p?.type === "boolean"
              ) {
                keys.push(k)
              } else if (
                k === "properties" &&
                p?.type === "object" &&
                p?.properties
              ) {
                const nestedProps = p.properties as any
                const nestedReq: string[] = Array.isArray(p.required)
                  ? p.required
                  : Object.keys(nestedProps)
                for (const nk of nestedReq) {
                  const np = nestedProps[nk]
                  if (
                    np?.enum ||
                    np?.type === "string" ||
                    np?.type === "number" ||
                    np?.type === "boolean"
                  ) {
                    keys.push(`${k}.${nk}`)
                  }
                }
              }
            }
            // Fallback: include common primitives if none required
            if (!keys.length) {
              for (const [k, p] of Object.entries<any>(props)) {
                if (
                  k === "properties" &&
                  p?.type === "object" &&
                  p?.properties
                ) {
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
        } catch {}
        // Prefer curated requiredParams when present (limits noisy fields) and always include them in the display set
        if (openSlug) {
          const ca = CURATED_ACTIONS.find((a) => a.slug === openSlug)
          const rp = (ca as any)?.requiredParams
          if (rp && typeof rp === "object") {
            // Special-case: HubSpot contact expects nested properties
            if (openSlug === "HUBSPOT_CREATE_CONTACT_OBJECT_WITH_PROPERTIES") {
              // Override keys to our curated set for better UX
              keys.length = 0
              keys.push(
                "properties.email",
                "properties.firstname",
                "properties.lastname",
                "properties.phone",
                "properties.company"
              )
            } else {
              // If schema produced a noisy set, clamp to curated keys
              const curatedKeys = Object.keys(rp)
              if (curatedKeys.length) {
                // Replace only if schema produced too many keys or none
                if (!keys.length || keys.length > curatedKeys.length + 5) {
                  keys.length = 0
                  for (const k of curatedKeys) keys.push(k)
                }
                // Always ensure curated keys are present in the display list
                for (const ck of curatedKeys)
                  if (!keys.includes(ck)) keys.push(ck)
              }
            }
          }
        }
        setSchemaKeys(keys)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        // On error, still attempt curated fallback so the UI isn't blank
        setSchemaError(e instanceof Error ? e.message : String(e))
        const keys: string[] = []
        if (openSlug) {
          const ca = CURATED_ACTIONS.find((a) => a.slug === openSlug)
          const rp = (ca as any)?.requiredParams
          if (rp && typeof rp === "object") {
            if (openSlug === "HUBSPOT_CREATE_CONTACT_OBJECT_WITH_PROPERTIES") {
              keys.push(
                "properties.email",
                "properties.firstname",
                "properties.lastname",
                "properties.phone",
                "properties.company"
              )
            } else {
              for (const k of Object.keys(rp)) keys.push(k)
            }
          }
        }
        if (keys.length) setSchemaKeys(keys)
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [openSlug, currentItem, currentAuthReady, needsSetupFromServer])

  // Load questions list for mapping
  useEffect(() => {
    if (!formId || !openSlug) return
    let cancelled = false
    setQuestionsLoading(true)
    setQuestionsError(null)
    fetch(`/api/forms/${formId}/questions`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "")
          throw new Error(text || `Failed to load questions (${res.status})`)
        }
        return res.json() as Promise<{
          success: boolean
          questions?: { id: string; label: string }[]
        }>
      })
      .then((json) => {
        if (cancelled) return
        setQuestions(json.questions || [])
      })
      .catch((e) => {
        if (cancelled) return
        setQuestionsError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [formId, openSlug])

  // helpers moved to SetupDialogParts/helpers

  // MappingSelect now lives in ParamsConfigurator

  // Advanced JSON mapping removed

  // No generic JSON save path (removed)

  return (
    <Drawer.Root
      open={Boolean(openSlug)}
      onOpenChange={(open) => setOpenSlug(open ? openSlug : null)}
      direction="right"
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/30" />
        <Drawer.Content className="bg-background sm :w-[460px] fixed top-0 right-0 z-[61] h-full w-[min(92vw,520px)] border-l shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-base font-semibold">
              {currentItem ? `Setup ${currentItem.label}` : "Setup action"}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpenSlug(null)}>
              Close
            </Button>
          </div>

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

                {/* Removed standalone Close button to always surface config/auth steps */}

                {/* Slack and HubSpot special cases removed; unified dynamic section below */}

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
                  />
                ) : null}

                {/* Generic JSON config removed */}

                {currentItem.provider === "usesend" ? (
                  <div className="text-muted-foreground text-sm">
                    This action does not require connection or defaults.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
