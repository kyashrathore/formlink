"use client"

import type { ActionToolSummary } from "@/app/lib/actions/api-types"
import { getActionDescriptor } from "@/app/lib/actions/registry"
import type { ActionDescriptor } from "@/app/lib/actions/registry"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Separator,
  Textarea,
} from "@formlink/ui"
import { cn } from "@formlink/ui/lib/utils"
import Ajv, { type ValidateFunction } from "ajv"
import addFormats from "ajv-formats"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCcw,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useActionTools } from "../../hooks/useActionTools"

interface ActionsExecutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  selectedSubmissionIds: string[]
  onRequestSetup?: () => void
  allowedSlugs?: string[]
  onlyConfiguredInPlan?: boolean
}

type ActionItem = ActionToolSummary & {
  statusLabel: string
  configured: boolean
  descriptor?: ActionDescriptor
}

function resolveStatusLabel(
  provider: "usesend" | "composio",
  status: string,
  remoteEnabled: boolean
) {
  if (provider === "usesend") {
    if (status === "connected" || status === "ready") return "Ready"
    return "Check configuration"
  }
  if (!remoteEnabled) return "Integration disabled"
  if (!status || status === "unknown") return "Needs auth"
  const lowered = status.toLowerCase()
  if (lowered.includes("pending")) return "Pending auth"
  if (lowered === "connected" || lowered === "ready") return "Ready"
  return status
}

function createDefaultOverrides() {
  return "{\n  \n}"
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

//

export function ActionsExecutionDialog({
  open,
  onOpenChange,
  formId,
  selectedSubmissionIds,
  onRequestSetup,
  allowedSlugs,
  onlyConfiguredInPlan,
}: ActionsExecutionDialogProps) {
  const {
    tools,
    isLoading: loadingTools,
    error: toolsError,
    enabled: remoteEnabled,
    refresh: refreshTools,
  } = useActionTools({ formId, enabled: open })
  // Config management deferred; using curated defaults only.

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [overrideDraft, setOverrideDraft] = useState<string>(
    createDefaultOverrides()
  )
  const [runError, setRunError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const ajv = useMemo(() => {
    const instance = new Ajv({ allErrors: true, strict: false })
    try {
      addFormats(instance)
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[actions] ajv-formats unavailable in dialog", error)
      }
    }
    return instance
  }, [])
  const [validator, setValidator] = useState<ValidateFunction | null>(null)

  const configBySlug = useMemo(() => new Map<string, any>(), [])

  const items: ActionItem[] = useMemo(() => {
    const allowed = new Set((allowedSlugs || []).filter(Boolean))
    const mapped = tools.map((tool) => {
      const cfg = configBySlug.get(tool.slug)
      const statusLabel = resolveStatusLabel(
        tool.provider,
        tool.authStatus || cfg?.authStatus || "unknown",
        remoteEnabled
      )
      const configured = false
      const descriptor = getActionDescriptor(tool.slug)
      return {
        ...tool,
        statusLabel,
        configured,
        descriptor,
      } as ActionItem
    })

    const filteredByPlan = allowed.size
      ? mapped.filter((item) => allowed.has(item.slug))
      : mapped

    return onlyConfiguredInPlan
      ? filteredByPlan.filter((item) => item.configured)
      : filteredByPlan
  }, [tools, configBySlug, remoteEnabled, allowedSlugs, onlyConfiguredInPlan])

  const readyItems = useMemo(
    () => items.filter((item) => item.statusLabel === "Ready"),
    [items]
  )

  useEffect(() => {
    if (!open) return
    if (items.length === 0) {
      setSelectedSlug(null)
      return
    }
    const existing = items.find((item) => item.slug === selectedSlug)
    if (existing) return
    const fallback = readyItems[0] || items[0]
    setSelectedSlug(fallback ? fallback.slug : null)
  }, [open, items, selectedSlug, readyItems])

  useEffect(() => {
    if (!open) {
      setRunError(null)
      setSuccessMessage(null)
      setOverrideDraft(createDefaultOverrides())
      setRunning(false)
      setSchema(null)
      setValidator(null)
      setSchemaError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    refreshTools()
  }, [open, refreshTools])

  useEffect(() => {
    if (!open) return
    const action = items.find((item) => item.slug === selectedSlug)
    if (!action || action.provider !== "composio") {
      setSchema(null)
      setValidator(null)
      setSchemaError(null)
      return
    }

    let cancelled = false
    setLoadingSchema(true)
    setSchemaError(null)

    const params = new URLSearchParams({
      formId,
      toolSlug: action.slug,
    })

    fetch(`/api/actions/schema?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Schema request failed (${res.status})`)
        }
        return res.json() as Promise<{
          success: boolean
          schema?: Record<string, unknown>
        }>
      })
      .then((json) => {
        if (cancelled) return
        const incomingSchema = json.schema || null
        setSchema(incomingSchema)
        setSchemaError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setSchema(null)
        setSchemaError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (!cancelled) setLoadingSchema(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, selectedSlug, items, formId])

  useEffect(() => {
    if (!schema) {
      setValidator(null)
      return
    }
    try {
      const compiled = ajv.compile(schema)
      setValidator(compiled)
      setSchemaError(null)
    } catch (error) {
      setValidator(null)
      setSchemaError(
        error instanceof Error ? error.message : "Unable to compile schema"
      )
    }
  }, [schema, ajv])

  const selectedAction = selectedSlug
    ? items.find((item) => item.slug === selectedSlug)
    : null
  // No persisted per-action config in this dialog currently
  const storedConfig: Record<string, unknown> = {}
  const selectedDescriptor =
    selectedAction?.descriptor ??
    (selectedAction ? getActionDescriptor(selectedAction.slug) : undefined)

  const canRun =
    Boolean(selectedAction) &&
    selectedAction?.statusLabel === "Ready" &&
    (selectedAction?.provider === "usesend" || remoteEnabled)

  const needsSetup =
    Boolean(selectedAction) &&
    (selectedAction?.statusLabel !== "Ready" || !selectedAction?.configured)

  async function handleRun() {
    if (!selectedAction) return
    if (!canRun) return
    if (!selectedSubmissionIds.length) {
      setRunError("Select at least one submission to run this action.")
      return
    }

    let overrides: Record<string, unknown> = {}
    try {
      const trimmed = overrideDraft.trim()
      overrides = trimmed ? JSON.parse(trimmed) : {}
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : "Unable to parse overrides"
      )
      return
    }

    const params = { ...storedConfig, ...overrides }

    if (validator) {
      const ok = validator(params)
      if (!ok) {
        const messages = (validator.errors || []).map((error) => {
          const path = error.instancePath || error.schemaPath
          return path ? `${path}: ${error.message}` : error.message
        })
        setRunError(
          messages.filter(Boolean).join("; ") || "Parameters failed validation"
        )
        return
      }
    }
    const payload = {
      formId,
      submissionIds: selectedSubmissionIds,
      action: {
        kind: selectedAction.provider === "usesend" ? "email" : "composio",
        slug: selectedAction.slug,
        params,
        idempotencyKey: randomId(),
      },
    }

    setRunning(true)
    setRunError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch("/api/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Run failed (${res.status})`)
      }
      const json = await res.json()
      setSuccessMessage(
        json?.status === "duplicate"
          ? "Action already completed for this selection."
          : "Action queued successfully."
      )
      refreshTools()
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error))
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Run suggested actions</DialogTitle>
          <DialogDescription>
            Execute curated integrations using the stored defaults for this
            form.
          </DialogDescription>
        </DialogHeader>

        {toolsError ? (
          <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
            Failed to load actions: {toolsError.message}
          </div>
        ) : null}
        {/* no stored configs UI yet */}

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs font-medium uppercase">
              Actions
            </div>
            <div className="space-y-2">
              {items.map((item) => {
                const isActive = item.slug === selectedSlug
                return (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => setSelectedSlug(item.slug)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/20 hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{item.label}</span>
                      <Badge
                        variant={
                          item.statusLabel === "Ready" ? "default" : "secondary"
                        }
                      >
                        {item.statusLabel}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                      <span className="uppercase">{item.provider}</span>
                      {item.toolkit ? (
                        <span className="uppercase">/{item.toolkit}</span>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="text-muted-foreground mt-2 text-xs">
                        {item.description}
                      </p>
                    ) : null}
                    {item.descriptor?.helpText ? (
                      <p className="text-muted-foreground text-[11px]">
                        {item.descriptor.helpText}
                      </p>
                    ) : null}
                    {!item.configured ? (
                      <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> Needs setup
                      </div>
                    ) : null}
                  </button>
                )
              })}
              {items.length === 0 && !loadingTools ? (
                <div className="text-muted-foreground text-xs">
                  No actions available yet.
                </div>
              ) : null}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1"
              onClick={() => {
                refreshTools()
              }}
              disabled={loadingTools}
            >
              <RefreshCcw
                className={cn("h-3.5 w-3.5", loadingTools && "animate-spin")}
              />
              Refresh
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-muted-foreground text-xs">
                Submissions selected: {selectedSubmissionIds.length}
              </div>
              {needsSetup && onRequestSetup ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRequestSetup?.()}
                  className="gap-1"
                >
                  Open Response Plan
                  <ArrowRight className="h-3 w-3" />
                </Button>
              ) : null}
            </div>

            <div className="border-muted-foreground/20 bg-muted/30 rounded-md border p-3">
              <div className="text-muted-foreground text-xs font-medium">
                Stored defaults
              </div>
              {selectedDescriptor?.hiddenFields?.length ? (
                <p className="text-muted-foreground text-[11px]">
                  Auto-filled: {selectedDescriptor.hiddenFields.join(", ")}
                </p>
              ) : null}
              <pre className="bg-background/60 mt-2 max-h-48 overflow-auto rounded p-3 text-xs">
                {JSON.stringify(storedConfig, null, 2)}
              </pre>
            </div>

            {loadingSchema ? (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading tool
                schema…
              </div>
            ) : null}
            {schemaError ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                Unable to load schema: {schemaError}
              </div>
            ) : null}
            {schema && Array.isArray((schema as any).required) ? (
              <div className="text-muted-foreground text-xs">
                Required fields: {(schema as any).required.join(", ") || "—"}
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-muted-foreground text-xs font-medium">
                Runtime overrides (JSON)
              </div>
              <Textarea
                rows={6}
                spellCheck={false}
                value={overrideDraft}
                onChange={(event) => setOverrideDraft(event.target.value)}
                className="font-mono text-xs"
              />
            </div>

            {runError ? (
              <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
                {runError}
              </div>
            ) : null}
            {successMessage ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  {successMessage}
                </div>
              </div>
            ) : null}

            {selectedSubmissionIds.length === 0 ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                Select at least one response in the table to enable execution.
              </div>
            ) : null}

            <Separator />

            <div className="flex items-center justify-between gap-2">
              <div className="text-muted-foreground text-xs">
                Actions run immediately and log to the Activity stream.
              </div>
              <Button
                size="sm"
                onClick={handleRun}
                disabled={
                  !canRun || running || selectedSubmissionIds.length === 0
                }
                className="gap-1"
              >
                {running ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                Run action
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ActionsExecutionDialog
