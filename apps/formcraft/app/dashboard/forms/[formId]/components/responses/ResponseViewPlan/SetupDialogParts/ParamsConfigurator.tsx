"use client"

import {
  finalizeSuggestion,
  flattenScalarPaths,
  getByPath,
  parseToken,
  setByPath,
  tokenForQuestion,
} from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDialogParts/helpers"
import { useResponseViewsStore } from "@/app/dashboard/forms/[formId]/stores/useResponseViewsStore"
import { Button, Textarea } from "@formlink/ui"
import { Loader2, Save } from "lucide-react"
import React, { useCallback, useMemo } from "react"

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

type Question = { id: string; label: string }

interface ParamsConfiguratorProps {
  formId?: string
  currentItem: ActionItem
  schemaKeys: string[]
  schemaLoading: boolean
  schemaError: string | null
  suggestLoading: boolean
  suggestError: string | null
  suggestRationale: string | null
  setSuggestLoading: (b: boolean) => void
  setSuggestError: (s: string | null) => void
  setSuggestRationale: (s: string | null) => void
  paramsDrafts: Record<string, Record<string, unknown>>
  setParamsDrafts: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, unknown>>>
  >
  questions: Question[]
  activeView: any | null
  refreshTools: () => void
  setOpenSlug: (slug: string | null) => void
  savingConfig: boolean
  setSavingConfig: (b: boolean) => void
  onSaveParams?: (
    slug: string,
    params: Record<string, unknown>
  ) => Promise<void> | void
}

const DEFAULT_VIEW_ID = "default"
const GLOBAL_FORM_ID = "__global__"
const DEFAULT_VIEW_NAME = "Smart View"

export function ParamsConfigurator(props: ParamsConfiguratorProps) {
  const {
    formId,
    currentItem,
    schemaKeys,
    schemaLoading,
    schemaError,
    suggestLoading,
    suggestError,
    suggestRationale,
    setSuggestLoading,
    setSuggestError,
    setSuggestRationale,
    paramsDrafts,
    setParamsDrafts,
    questions,
    activeView,
    refreshTools,
    setOpenSlug,
    savingConfig,
    setSavingConfig,
    onSaveParams,
  } = props
  const handleMapChange = useCallback(
    (path: string, val: string) => {
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
    },
    [currentItem?.slug, setParamsDrafts]
  )

  const MappingSelect = ({ path }: { path: string }) => {
    const current = getByPath(paramsDrafts[currentItem!.slug] || {}, path)
    const mappedQ = parseToken(current)
    const onChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) =>
        handleMapChange(path, e.target.value),
      [handleMapChange, path]
    )
    return (
      <select
        className="bg-background text-muted-foreground min-h-8 w-full rounded border px-2 py-1 text-xs"
        value={mappedQ || "__static__"}
        onChange={onChange}
      >
        <option value="__static__">Static value…</option>
        {questions.map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
          </option>
        ))}
      </select>
    )
  }

  const suggestedPaths = useMemo(
    () => flattenScalarPaths(paramsDrafts[currentItem.slug] || {}),
    [currentItem.slug, paramsDrafts]
  )
  const displayPaths = useMemo(
    () => Array.from(new Set<string>([...schemaKeys, ...suggestedPaths])),
    [schemaKeys, suggestedPaths]
  )

  const handleSuggestClick = useCallback(async () => {
    if (!formId || !currentItem) return
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
      const json = await res.json().catch(() => ({}) as any)
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
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : String(e))
    } finally {
      setSuggestLoading(false)
    }
  }, [
    currentItem.slug,
    formId,
    questions,
    setParamsDrafts,
    setSuggestError,
    setSuggestLoading,
    setSuggestRationale,
  ])

  const handleParamChange = useCallback(
    (path: string, value: string) => {
      setParamsDrafts((prev) => {
        const next = { ...(prev || {}) }
        const bucket = { ...(next[currentItem!.slug] || {}) }
        setByPath(bucket, path, value)
        next[currentItem!.slug] = bucket
        return next
      })
    },
    [currentItem?.slug, setParamsDrafts]
  )

  const handleSaveClick = useCallback(async () => {
    if (!formId) return
    setSavingConfig(true)
    try {
      const existing = Array.isArray((activeView as any)?.actions)
        ? ([...((activeView as any).actions as any[])] as any[])
        : []
      const idx = existing.findIndex((a) => a?.slug === currentItem.slug)
      const nextParams = finalizeSuggestion(
        currentItem.slug,
        paramsDrafts[currentItem.slug] || {},
        questions
      )
      if (onSaveParams) {
        await onSaveParams(currentItem.slug, nextParams)
        refreshTools()
        setOpenSlug(null)
        return
      }
      const updatedItem =
        idx !== -1
          ? { ...existing[idx], params: nextParams }
          : { slug: currentItem.slug, params: nextParams }
      if (idx === -1) existing.push(updatedItem)
      else existing[idx] = updatedItem

      const nextActionSlugs = Array.from(
        new Set<string>([
          ...(((activeView as any)?.actionSlugs || []) as string[]),
          currentItem.slug,
        ])
      )

      const mustCreate =
        !activeView ||
        (activeView as any).id === DEFAULT_VIEW_ID ||
        (activeView as any).formId === GLOBAL_FORM_ID ||
        (activeView as any).formId !== formId

      if (mustCreate || !(activeView as any).saved) {
        const payload = {
          name: (activeView as any)?.name || DEFAULT_VIEW_NAME,
          type: (activeView as any)?.type || "list",
          filters: (activeView as any)?.filters || [],
          sort: (activeView as any)?.sort || undefined,
          insights_spec: (activeView as any)?.insights || [],
          actions: existing,
          actionSlugs: nextActionSlugs,
        }
        const createRes = await fetch(`/api/forms/${formId}/views`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
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
        useResponseViewsStore.setState((state) => {
          const nextViews = [...state.views]
          nextViews.push({
            id: newId,
            formId: formId!,
            name: payload.name,
            description: undefined,
            columns: [],
            sort: payload.sort,
            filters: payload.filters,
            pageSize: 20,
            saved: true,
            insights: payload.insights_spec,
            actionSlugs: nextActionSlugs,
            actions: existing as any,
          } as any)
          const nextActive = { ...state.activeViewIdMap, [formId!]: newId }
          return { views: nextViews, activeViewIdMap: nextActive } as any
        })
        refreshTools()
        setOpenSlug(null)
        return
      }

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
        throw new Error(text || `Failed to save params (${res.status})`)
      }
      useResponseViewsStore.setState((state) => {
        const views = state.views.map((v) =>
          v.id === (activeView as any).id
            ? { ...v, actions: existing as any, actionSlugs: nextActionSlugs }
            : v
        )
        return { views }
      })
      refreshTools()
      setOpenSlug(null)
    } finally {
      setSavingConfig(false)
    }
  }, [
    activeView,
    currentItem.slug,
    formId,
    onSaveParams,
    paramsDrafts,
    questions,
    refreshTools,
    setOpenSlug,
    setSavingConfig,
  ])

  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-sm font-medium">Step 3: Configure parameters</div>
      <div className="text-muted-foreground text-sm">
        Fields from schema and AI suggestions.
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={suggestLoading || !formId}
          onClick={handleSuggestClick}
        >
          Suggest from AI
        </Button>
        {suggestLoading ? (
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" /> Generating…
          </div>
        ) : null}
      </div>
      {suggestError ? (
        <div className="text-destructive text-xs">{suggestError}</div>
      ) : null}
      {suggestRationale ? (
        <div className="text-muted-foreground rounded-md border p-2 text-xs whitespace-pre-wrap">
          {suggestRationale}
        </div>
      ) : null}

      {/* Fields */}
      <div className="rounded-md border">
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="text-sm font-medium">Parameters</div>
          {schemaLoading ? (
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading schema…
            </div>
          ) : schemaError ? (
            <div className="text-destructive text-xs">{schemaError}</div>
          ) : null}
        </div>
        <div>
          {displayPaths.length === 0 ? (
            <div className="text-muted-foreground px-2 pb-2 text-xs">
              No fields detected for this action.
            </div>
          ) : (
            displayPaths.map((path) => {
              const value = String(
                getByPath(paramsDrafts[currentItem!.slug] || {}, path) ?? ""
              )
              const onParamChange = (
                e: React.ChangeEvent<HTMLTextAreaElement>
              ) => handleParamChange(path, e.target.value)
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
                      onChange={onParamChange}
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="h-5" />
                    {formId ? <MappingSelect path={path} /> : null}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Save */}
      <Button
        size="sm"
        className="mt-1"
        disabled={savingConfig}
        onClick={handleSaveClick}
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
  )
}
