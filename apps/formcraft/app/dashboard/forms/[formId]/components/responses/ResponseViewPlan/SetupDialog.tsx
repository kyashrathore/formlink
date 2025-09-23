"use client"

import {
  humanizeToolkit,
  requiresParamsForSlug,
} from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import { useResponseViewsStore } from "@/app/dashboard/forms/[formId]/stores/useResponseViewsStore"
import { CURATED_ACTIONS } from "@/app/lib/actions/registry"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleUI,
  Textarea,
} from "@formlink/ui"
import { cn } from "@formlink/ui/lib/utils"
import { CheckCircle2, Circle, Loader2, Plug, Save } from "lucide-react"
import React, { useEffect, useMemo, useState } from "react"

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
        let next = ((json as any)?.suggestion?.params || {}) as Record<
          string,
          unknown
        >
        // Normalize HubSpot suggestion into { properties: { ... } }
        if (
          currentItem.slug === "HUBSPOT_CREATE_CONTACT_OBJECT_WITH_PROPERTIES"
        ) {
          const hasProps =
            next && typeof next === "object" && (next as any).properties
          if (!hasProps) {
            const props: Record<string, unknown> = {}
            for (const k of [
              "email",
              "firstname",
              "lastname",
              "phone",
              "company",
            ]) {
              if ((next as any)[k] != null) props[k] = (next as any)[k]
            }
            next = { properties: props }
          }
        }
        // Google Sheets: suggest values row if missing
        if (currentItem.slug === "GOOGLESHEETS_BATCH_UPDATE") {
          const already = (next as any).values
          if (!already) {
            const rng = String((next as any)?.range || "")
            const colCount =
              countColsFromRange(rng) || Math.max(1, questions.length || 0)
            const row: string[] = []
            for (let i = 0; i < colCount; i++) {
              const q = questions[i]
              row.push(q ? tokenForQuestion(q.id) : "")
            }
            ;(next as any).values = [row]
          }
        }
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
        let next = ((json as any)?.suggestion?.params || {}) as Record<
          string,
          unknown
        >
        // Normalize HubSpot suggestion into { properties: { ... } }
        if (
          currentItem.slug === "HUBSPOT_CREATE_CONTACT_OBJECT_WITH_PROPERTIES"
        ) {
          const hasProps =
            next && typeof next === "object" && (next as any).properties
          if (!hasProps) {
            const props: Record<string, unknown> = {}
            for (const k of [
              "email",
              "firstname",
              "lastname",
              "phone",
              "company",
            ]) {
              if ((next as any)[k] != null) props[k] = (next as any)[k]
            }
            next = { properties: props }
          }
        }
        // Google Sheets: suggest values row if missing
        if (currentItem.slug === "GOOGLESHEETS_BATCH_UPDATE") {
          const already = (next as any).values
          if (!already) {
            const rng = String((next as any)?.range || "")
            const colCount =
              countColsFromRange(rng) || Math.max(1, questions.length || 0)
            const row: string[] = []
            for (let i = 0; i < colCount; i++) {
              const q = questions[i]
              row.push(q ? tokenForQuestion(q.id) : "")
            }
            ;(next as any).values = [row]
          }
        }
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

  // helpers for nested path read/write (e.g., properties.email)
  const getByPath = (obj: any, path: string) => {
    return path
      .split(".")
      .reduce((acc, key) => (acc ? acc[key] : undefined), obj)
  }
  const setByPath = (obj: any, path: string, value: unknown) => {
    const parts = path.split(".")
    const last = parts.pop() as string
    let cursor = obj
    for (const p of parts) {
      if (!cursor[p] || typeof cursor[p] !== "object") cursor[p] = {}
      cursor = cursor[p]
    }
    cursor[last] = value
  }

  // Flatten object into dot paths for scalar leaves to allow showing all suggested fields
  const flattenScalarPaths = (obj: any, base = ""): string[] => {
    const out: string[] = []
    if (!obj || typeof obj !== "object") return out
    for (const [k, v] of Object.entries(obj)) {
      const path = base ? `${base}.${k}` : k
      if (
        v == null ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        out.push(path)
      } else if (Array.isArray(v)) {
        // Keep parent editable for arrays; nested item mapping not supported here
        out.push(path)
      } else if (typeof v === "object") {
        const nested = flattenScalarPaths(v, path)
        if (nested.length) out.push(...nested)
        else out.push(path)
      }
    }
    return out
  }

  const tokenForQuestion = (qid: string) => `{{answer:${qid}}}`
  const parseToken = (value: unknown): string | null => {
    if (typeof value !== "string") return null
    const m = value.match(/^\{\{\s*answer:([^}]+)\s*\}\}$/)
    return m ? (m[1] ?? null) : null
  }

  // --- Suggestion helpers (Sheets + normalization) ---
  const excelColToIndex = (letters: string): number => {
    let n = 0
    const up = letters.toUpperCase()
    for (let i = 0; i < up.length; i++) {
      const code = up.charCodeAt(i)
      if (code < 65 || code > 90) return 0 // not A-Z
      const c = code - 64 // 'A' -> 1
      n = n * 26 + c
    }
    return n
  }
  const countColsFromRange = (range?: string): number | null => {
    if (!range) return null
    // Accept forms like Sheet1!A2:H or A2:H10 or A:H
    const m = range.match(/([A-Z]+)\d*\s*:\s*([A-Z]+)/i)
    if (!m) return null
    const start = excelColToIndex(m[1]!)
    const end = excelColToIndex(m[2]!)
    if (!start || !end) return null
    return Math.max(1, end - start + 1)
  }

  const finalizeSuggestion = (
    slug: string,
    base: Record<string, unknown>
  ): Record<string, unknown> => {
    let next = { ...(base || {}) }
    if (slug === "HUBSPOT_CREATE_CONTACT_OBJECT_WITH_PROPERTIES") {
      const hasProps =
        next && typeof next === "object" && (next as any).properties
      if (!hasProps) {
        const props: Record<string, unknown> = {}
        for (const k of [
          "email",
          "firstname",
          "lastname",
          "phone",
          "company",
        ]) {
          if ((next as any)[k] != null) props[k] = (next as any)[k]
        }
        next = { ...next, properties: props }
      }
    }
    if (slug === "GOOGLESHEETS_BATCH_UPDATE") {
      const already = (next as any).values
      if (!already) {
        const rng = String((next as any)?.range || "")
        const colCount =
          countColsFromRange(rng) || Math.max(1, questions.length || 0)
        const row: string[] = []
        for (let i = 0; i < colCount; i++) {
          const q = questions[i]
          row.push(q ? tokenForQuestion(q.id) : "")
        }
        ;(next as any).values = [row]
      }
    }
    return next
  }

  const MappingSelect = ({ path }: { path: string }) => {
    const current = getByPath(paramsDrafts[currentItem!.slug] || {}, path)
    const mappedQ = parseToken(current)
    return (
      <select
        className="bg-background text-muted-foreground min-h-8 w-full rounded border px-2 py-1 text-xs"
        value={mappedQ || "__static__"}
        onChange={(e) => {
          const val = e.target.value
          setParamsDrafts((prev) => {
            const next = { ...(prev || {}) }
            const bucket = { ...(next[currentItem!.slug] || {}) }
            setByPath(
              bucket,
              path,
              val === "__static__" ? "" : tokenForQuestion(val)
            )
            next[currentItem!.slug] = bucket
            return next
          })
        }}
      >
        <option value="__static__">Static</option>
        {questions.map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
          </option>
        ))}
      </select>
    )
  }

  // Advanced JSON mapping removed

  // No generic JSON save path (removed)

  return (
    <Dialog
      open={Boolean(openSlug)}
      onOpenChange={(open) => setOpenSlug(open ? openSlug : null)}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitleUI>
            {currentItem ? `Setup ${currentItem.label}` : "Setup action"}
          </DialogTitleUI>
        </DialogHeader>

        {currentItem ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge
                variant={
                  (currentItem.status || "").toLowerCase() === "ready"
                    ? "default"
                    : "secondary"
                }
              >
                {currentItem.status}
              </Badge>
              <span className="text-muted-foreground">
                Toolkit: {humanizeToolkit(currentItem.toolkit || "")}
              </span>
            </div>

            {/* Included actions */}
            <div className="rounded-md border p-2">
              <div className="text-muted-foreground mb-1 text-sm font-medium">
                Actions included
              </div>
              <div className="max-w-100 space-y-1">
                {includedActionsForCurrent.map((it) => (
                  <div
                    key={it.slug}
                    className="flex flex-col items-baseline justify-between gap-2"
                  >
                    <div className="truncate text-sm">{it.label}</div>
                    <div className="text-muted-foreground truncate font-mono text-xs">
                      {it.toolSlug || it.slug}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Auth steps (Composio) */}
            {currentItem.provider === "composio" &&
            currentItem.status !== "Ready" ? (
              <div className="mt-2 space-y-3">
                {/* Step 1 */}
                <div className="relative flex items-start gap-2 text-sm">
                  {currentAuthReady || redirectAuthLink ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="text-muted-foreground h-4 w-4" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">Generate OAuth URL</div>
                    <div className="text-muted-foreground text-xs">
                      Create a secure authorization link.
                    </div>
                    {!currentAuthReady && !redirectAuthLink ? (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-sm"
                          onClick={async () => {
                            if (!formId) return
                            try {
                              setConnectError(null)
                              setConnectStage("generating")
                              setAuthingSlug(currentItem.slug)
                              const res = await fetch(
                                "/api/actions/authorize",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    formId,
                                    toolkit: derivedToolkit,
                                    toolSlug: currentItem.slug,
                                  }),
                                  credentials: "include",
                                }
                              )
                              if (res.ok) {
                                const json = await res.json().catch(() => ({}))
                                const link = json?.link?.redirectUrl
                                if (link) {
                                  setLastAuthLinkByToolkit((prev) => ({
                                    ...prev,
                                    [derivedToolkit]: link,
                                  }))
                                  setConnectStage("awaiting_user")
                                }
                                setPollingSlug(currentItem.slug)
                                refreshTools()
                              } else {
                                const text = await res.text().catch(() => "")
                                setConnectError(
                                  text || `Authorization failed (${res.status})`
                                )
                                setConnectStage("error")
                              }
                            } finally {
                              setAuthingSlug(null)
                            }
                          }}
                        >
                          {connectStage === "generating" ? (
                            <>Generating…</>
                          ) : (
                            <>
                              <Plug className="mr-1 h-3 w-3" /> Generate OAuth
                              URL
                            </>
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "absolute top-5 left-2 h-8 w-0.5",
                      connectStage !== "idle" ? "bg-primary" : "bg-muted"
                    )}
                  />
                </div>

                {/* Step 2 */}
                <div className="relative flex items-start gap-2 text-sm">
                  {currentAuthReady ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="text-muted-foreground h-4 w-4" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">Authorize in provider</div>
                    <div className="text-muted-foreground text-xs">
                      Open the provider link to finish sign‑in.
                    </div>
                    {!currentAuthReady && redirectAuthLink ? (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-sm"
                          onClick={() => {
                            try {
                              window.open(
                                redirectAuthLink,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            } catch {}
                            setConnectStage("awaiting_user")
                          }}
                        >
                          Open authorization
                        </Button>
                      </div>
                    ) : null}
                    {connectError ? (
                      <div className="text-destructive mt-1 text-xs">
                        {connectError}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "absolute top-5 left-2 h-8 w-0.5",
                      connectStage === "awaiting_user" ||
                        connectStage === "verifying" ||
                        connectStage === "done"
                        ? "bg-primary"
                        : "bg-muted"
                    )}
                  />
                </div>
                {/* Step 3 hint is shown by config section below */}
              </div>
            ) : null}

            {/* Removed standalone Close button to always surface config/auth steps */}

            {/* Slack and HubSpot special cases removed; unified dynamic section below */}

            {/* Dynamic provider-driven params (unified) */}
            {(needsParamsBySlug || needsSetupFromServer) &&
            !currentItem.configured &&
            // Allow configure when: non-Composio, or auth ready, or server explicitly flags needs_setup
            (currentItem.provider !== "composio" ||
              currentAuthReady ||
              needsSetupFromServer) ? (
              <div className="mt-3 space-y-1.5">
                <div className="text-sm font-medium">
                  Step 3: Configure parameters
                </div>
                <div className="text-muted-foreground text-sm">
                  Fields from schema and AI suggestions.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={suggestLoading || !formId}
                    onClick={async () => {
                      if (!formId || !currentItem) return
                      setSuggestLoading(true)
                      setSuggestError(null)
                      setSuggestRationale(null)
                      try {
                        const res = await fetch(`/api/actions/schema`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            formId,
                            slug: currentItem.slug,
                          }),
                        })
                        const json = await res.json().catch(() => ({}))
                        if (!res.ok || !json?.success) {
                          throw new Error(
                            json?.error || `Suggestion failed (${res.status})`
                          )
                        }
                        const raw = (json?.suggestion?.params || {}) as Record<
                          string,
                          unknown
                        >
                        const next = finalizeSuggestion(currentItem.slug, raw)
                        setParamsDrafts((prev) => ({
                          ...prev,
                          [currentItem.slug]: {
                            ...(prev[currentItem.slug] || {}),
                            ...(next || {}),
                          },
                        }))
                        if (json?.suggestion?.rationale)
                          setSuggestRationale(String(json.suggestion.rationale))
                      } catch (e) {
                        setSuggestError(
                          e instanceof Error ? e.message : String(e)
                        )
                      } finally {
                        setSuggestLoading(false)
                      }
                    }}
                  >
                    {suggestLoading ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />{" "}
                        Suggesting…
                      </>
                    ) : (
                      "Suggest with AI"
                    )}
                  </Button>
                  {suggestError ? (
                    <span className="text-destructive text-xs">
                      {suggestError}
                    </span>
                  ) : null}
                </div>
                {suggestRationale ? (
                  <div className="text-muted-foreground text-xs">
                    {suggestRationale}
                  </div>
                ) : null}
                {schemaError ? (
                  <div className="text-destructive text-xs">{schemaError}</div>
                ) : null}
                <div className="rounded-md border">
                  <div className="grid grid-cols-[2fr_1fr] gap-2 p-2">
                    <div className="text-muted-foreground text-xs font-medium">
                      Tool parameters
                    </div>
                    <div className="text-muted-foreground text-xs font-medium">
                      Map from answer
                    </div>
                  </div>
                  <div className="max-h-96 overflow-auto">
                    {schemaLoading ? (
                      <div className="text-muted-foreground px-2 pb-2 text-xs">
                        Loading fields…
                      </div>
                    ) : (
                      (() => {
                        const suggested = currentItem
                          ? flattenScalarPaths(
                              paramsDrafts[currentItem.slug] || {}
                            )
                          : []
                        const display = Array.from(
                          new Set<string>([...schemaKeys, ...suggested])
                        )
                        if (!display.length) {
                          return (
                            <div className="text-muted-foreground px-2 pb-2 text-xs">
                              No fields detected for this action.
                            </div>
                          )
                        }
                        return display.map((path) => {
                          const value = String(
                            getByPath(
                              paramsDrafts[currentItem!.slug] || {},
                              path
                            ) ?? ""
                          )
                          return (
                            <div
                              key={path}
                              className="grid grid-cols-[2fr_1fr] items-start gap-2 border-t p-2"
                            >
                              <div className="flex flex-col">
                                <div className="text-muted-foreground mb-1 text-[11px] leading-4 font-medium">
                                  {path}
                                </div>
                                <Textarea
                                  placeholder=""
                                  className="min-h-8 w-full text-sm"
                                  rows={1}
                                  value={value}
                                  onChange={(
                                    e: React.ChangeEvent<HTMLTextAreaElement>
                                  ) =>
                                    setParamsDrafts((prev) => {
                                      const next = { ...(prev || {}) }
                                      const bucket = {
                                        ...(next[currentItem!.slug] || {}),
                                      }
                                      setByPath(bucket, path, e.target.value)
                                      next[currentItem!.slug] = bucket
                                      return next
                                    })
                                  }
                                />
                              </div>
                              <div className="flex flex-col">
                                <div className="h-5" />
                                {formId ? <MappingSelect path={path} /> : null}
                              </div>
                            </div>
                          )
                        })
                      })()
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="mt-1"
                  disabled={savingConfig}
                  onClick={async () => {
                    if (!formId || !activeView) return
                    setSavingConfig(true)
                    try {
                      // Build next actions array with the configured params for this slug
                      const existing = Array.isArray(
                        (activeView as any).actions
                      )
                        ? ([...((activeView as any).actions as any[])] as any[])
                        : []
                      const idx = existing.findIndex(
                        (a) => a?.slug === currentItem.slug
                      )
                      const nextParams = finalizeSuggestion(
                        currentItem.slug,
                        paramsDrafts[currentItem.slug] || {}
                      )
                      const nextObj = {
                        slug: currentItem.slug,
                        provider: "composio" as const,
                        toolkit: derivedToolkit || currentItem.toolkit,
                        params: nextParams,
                      }
                      if (idx >= 0)
                        existing[idx] = { ...existing[idx], ...nextObj }
                      else existing.push(nextObj as any)
                      const nextActionSlugs: string[] = Array.isArray(
                        (activeView as any).actionSlugs
                      )
                        ? ([
                            ...((activeView as any).actionSlugs as string[]),
                          ] as string[])
                        : []
                      if (!nextActionSlugs.includes(currentItem.slug))
                        nextActionSlugs.push(currentItem.slug)

                      // If the view isn’t saved yet, create it first (auto‑save)
                      if (!(activeView as any).saved) {
                        const payload: any = {
                          name: (activeView as any).name || "Smart View",
                          description:
                            (activeView as any).description || undefined,
                          columns: (activeView as any).columns || [],
                          filters: (activeView as any).filters || [],
                          sort: (activeView as any).sort || undefined,
                          insights_spec: (activeView as any).insights || [],
                          actions: existing,
                          actionSlugs: nextActionSlugs,
                        }
                        const createRes = await fetch(
                          `/api/forms/${formId}/views`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify(payload),
                          }
                        )
                        let data: any = null
                        try {
                          data = await createRes.json()
                        } catch {}
                        if (!createRes.ok || !data?.view?.id) {
                          const msg =
                            (data && (data.error || data.message)) ||
                            `Failed to create view (${createRes.status})`
                          throw new Error(msg)
                        }
                        const newId: string = data.view.id
                        // Update store: replace ephemeral view with saved one
                        useResponseViewsStore.setState((state) => {
                          const idxView = state.views.findIndex(
                            (v) => v.id === (activeView as any).id
                          )
                          if (idxView === -1) return state as any
                          const existingView = state.views[idxView]
                          const nextViews = [...state.views]
                          nextViews[idxView] = {
                            ...existingView,
                            id: newId,
                            saved: true,
                            actions: existing as any,
                            actionSlugs: nextActionSlugs,
                          } as any
                          const nextActive = {
                            ...state.activeViewIdMap,
                            [formId]: newId,
                          }
                          return {
                            views: nextViews,
                            activeViewIdMap: nextActive,
                          } as any
                        })
                        refreshTools()
                        setOpenSlug(null)
                        return
                      }

                      // Otherwise, update existing saved view
                      const res = await fetch(
                        `/api/forms/${formId}/views/${(activeView as any).id}`,
                        {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            actions: existing,
                            actionSlugs: nextActionSlugs,
                          }),
                        }
                      )
                      if (!res.ok) {
                        const text = await res.text().catch(() => "")
                        throw new Error(
                          text || `Failed to save params (${res.status})`
                        )
                      }
                      useResponseViewsStore.setState((state) => {
                        const views = state.views.map((v) =>
                          v.id === (activeView as any).id
                            ? {
                                ...v,
                                actions: existing as any,
                                actionSlugs: nextActionSlugs,
                              }
                            : v
                        )
                        return { views }
                      })
                      refreshTools()
                      setOpenSlug(null)
                    } catch (e) {
                      console.error(e)
                    } finally {
                      setSavingConfig(false)
                    }
                  }}
                >
                  {savingConfig ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save className="mr-1 h-3 w-3" /> Save parameters
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            {/* Generic JSON config removed */}

            {currentItem.provider === "usesend" ? (
              <div className="text-muted-foreground text-sm">
                This action does not require connection or defaults.
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
