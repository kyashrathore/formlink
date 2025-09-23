"use client"

import { humanizeToolkit } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import { useFormEditorStore } from "@/app/dashboard/forms/[formId]/stores/useFormEditorStore"
import {
  CURATED_ACTIONS,
  getActionDescriptor,
} from "@/app/lib/actions/registry"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@formlink/ui"
import { cn } from "@formlink/ui/lib/utils"
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  Power,
  RefreshCcw,
  Settings2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useActionTools } from "../../hooks/useActionTools"
import EditableUrlInput from "./EditableUrlInput"

const examplePayload = `{
  "submissionId": "fd639ed1-2540-457f-91b0-4b395d2dbc85",
  "versionId": "220b6147-65f5-45b8-be65-f65f81b797da",
  "submissionStatus": "completed",
  "testmode": true,
  "answers": [
    {
      "q_id": "q_car_budget",
      "answer": "20000_35000",
      "is_additional_field": false
    },
    {
      "q_id": "q_car_body_type",
      "answer": "sedan",
      "is_additional_field": false
    },
    {
      "q_id": "q_car_fuel_type",
      "answer": ["gasoline"],
      "is_additional_field": false
    },
    {
      "q_id": "q_car_seating_capacity",
      "answer": "7plus",
      "is_additional_field": false
    },
    {
      "q_id": "q_car_features",
      "answer": ["sunroof"],
      "is_additional_field": false
    },
    {
      "q_id": "q_car_usage",
      "answer": "commuting",
      "is_additional_field": false
    }
  ]
}`

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
  const normalized = status.toLowerCase()
  if (normalized.includes("pending")) return "Pending auth"
  if (normalized === "connected" || normalized === "ready") return "Ready"
  return status
}

function ActionsIntegrationsSection() {
  const formId = useFormEditorStore((state) => state.form?.id)
  const {
    tools,
    isLoading: loadingTools,
    error: toolsError,
    enabled: remoteEnabled,
    refresh: refreshTools,
  } = useActionTools({ formId, enabled: Boolean(formId) })
  // Deprecated: global defaults removed; no configs API calls

  const [savingSlug, setSavingSlug] = useState<string | null>(null)
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({})
  const [authingSlug, setAuthingSlug] = useState<string | null>(null)
  const [pollingSlug, setPollingSlug] = useState<string | null>(null)

  const configBySlug = useMemo(() => new Map<string, any>(), [])

  // Removed drafts/config JSON handling

  useEffect(() => {
    if (!pollingSlug) return
    const pollInterval = setInterval(() => {
      refreshTools()
    }, 4000)
    const timeout = setTimeout(() => {
      setPollingSlug(null)
    }, 60_000)

    return () => {
      clearInterval(pollInterval)
      clearTimeout(timeout)
    }
  }, [pollingSlug, refreshTools])

  useEffect(() => {
    if (!pollingSlug) return
    const tool = tools.find((item) => item.slug === pollingSlug)
    const status = tool?.authStatus || configBySlug.get(pollingSlug)?.authStatus
    const resolved = resolveStatusLabel(
      tool?.provider || "composio",
      status || "unknown",
      remoteEnabled
    )
    if (resolved === "Ready") {
      setPollingSlug(null)
    }
  }, [tools, pollingSlug, configBySlug, remoteEnabled])

  // Removed config JSON save/reset handlers

  // No-op: disconnect handled per toolkit in card actions

  const handleAuthorize = async (slug: string, toolkit: string | undefined) => {
    if (!formId || !toolkit) {
      setInlineErrors((prev) => ({
        ...prev,
        [slug]: "Toolkit details missing for this action",
      }))
      return
    }
    setAuthingSlug(slug)
    setInlineErrors((prev) => {
      if (!prev[slug]) return prev
      const next = { ...prev }
      delete next[slug]
      return next
    })
    try {
      const res = await fetch("/api/actions/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId,
          toolkit,
          toolSlug: slug,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Authorization failed (${res.status})`)
      }
      const json = await res.json()
      const redirect = json?.link?.redirectUrl
      if (redirect) {
        window.open(redirect, "_blank", "noopener,noreferrer")
      }
      setPollingSlug(slug)
      refreshTools()
    } catch (error) {
      setInlineErrors((prev) => ({
        ...prev,
        [slug]: error instanceof Error ? error.message : String(error),
      }))
    } finally {
      setAuthingSlug(null)
    }
  }

  const itemsRaw = useMemo(() => {
    return tools.map((tool) => {
      const configRow = configBySlug.get(tool.slug)
      const statusLabel = resolveStatusLabel(
        tool.provider,
        tool.authStatus || configRow?.authStatus || "unknown",
        remoteEnabled
      )
      const configured = Boolean(
        configRow && Object.keys(configRow.config || {}).length > 0
      )
      const descriptor = getActionDescriptor(tool.slug)
      return {
        ...tool,
        statusLabel,
        configured,
        configRow,
        descriptor,
      }
    })
  }, [tools, configBySlug, remoteEnabled])

  const items = useMemo(() => {
    // Deduplicate to toolkit-level for composio and include only connected/ready
    const seen = new Set<string>()
    const list: typeof itemsRaw = []
    for (const it of itemsRaw) {
      if (it.provider === "composio") {
        const key = (it.toolkit || "").toLowerCase() || it.slug
        if (seen.has(key)) continue
        seen.add(key)
        list.push(it)
      } else {
        const key = `usesend`
        if (seen.has(key)) continue
        seen.add(key)
        list.push(it)
      }
    }
    return list.filter((i) => i.statusLabel === "Ready")
  }, [itemsRaw])

  type ToolkitCard = {
    key: string
    provider: "composio" | "usesend"
    toolkit?: string
    statusLabel: string
    actions: Array<{ slug: string; label: string; description?: string }>
    firstActionSlug?: string
  }

  const toolkitCards = useMemo(() => {
    const map = new Map<string, ToolkitCard>()
    for (const it of items) {
      if (it.provider === "composio") {
        const key = (it.toolkit || "").toLowerCase()
        if (!key) continue
        const existing = map.get(key)
        const statusLabel = it.statusLabel
        if (!existing) {
          map.set(key, {
            key,
            provider: "composio",
            toolkit: key,
            statusLabel,
            actions: [],
          })
        } else {
          if (statusLabel === "Ready") existing.statusLabel = "Ready"
        }
      } else if (it.provider === "usesend") {
        const key = "usesend"
        if (!map.has(key)) {
          map.set(key, {
            key,
            provider: "usesend",
            statusLabel: it.statusLabel,
            actions: [],
          })
        }
      }
    }
    for (const card of map.values()) {
      if (card.provider === "composio") {
        const acts = CURATED_ACTIONS.filter(
          (a) =>
            a.provider === "composio" &&
            (a.toolkit || "").toLowerCase() === (card.toolkit || "")
        )
        card.actions = acts.map((a) => ({
          slug: a.slug,
          label: a.label,
          description: a.description,
        }))
        if (!card.firstActionSlug && card.actions.length > 0)
          card.firstActionSlug = card.actions[0]!.slug
      } else if (card.provider === "usesend") {
        const acts = CURATED_ACTIONS.filter((a) => a.provider === "usesend")
        card.actions = acts.map((a) => ({
          slug: a.slug,
          label: a.label,
          description: a.description,
        }))
        if (!card.firstActionSlug && card.actions.length > 0)
          card.firstActionSlug = card.actions[0]!.slug
      }
    }
    return Array.from(map.values()).filter((c) => c.statusLabel === "Ready")
  }, [items])

  const isBusy = loadingTools

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="text-muted-foreground h-4 w-4" />
          <h2 className="text-lg font-semibold">Actions & Integrations</h2>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            refreshTools()
          }}
          disabled={isBusy}
        >
          <RefreshCcw
            className={cn("mr-1 h-3.5 w-3.5", isBusy && "animate-spin")}
          />
          Refresh
        </Button>
      </div>
      <Card className="border-muted-foreground/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Manage how Formlink routes follow-up actions.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {toolsError ? (
            <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
              Failed to load toolkit catalog: {toolsError.message}
            </div>
          ) : null}
          {/* no configs API; skipped */}

          {!formId ? (
            <div className="text-muted-foreground text-sm">
              Select a form to configure action integrations.
            </div>
          ) : null}

          {formId && items.length === 0 && !isBusy ? (
            <div className="text-muted-foreground text-sm">
              No integrations connected yet.
            </div>
          ) : null}

          {isBusy ? (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking
              integrations…
            </div>
          ) : null}

          {toolkitCards.map((card) => {
            const inlineError = inlineErrors[card.key]
            return (
              <div
                key={card.key}
                className="border-muted-foreground/20 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {card.provider === "composio"
                          ? humanizeToolkit(card.toolkit || "")
                          : "useSend"}
                      </span>
                      <Badge variant="secondary" className="uppercase">
                        {card.provider}
                      </Badge>
                      {card.provider === "composio" && card.toolkit ? (
                        <Badge variant="outline" className="uppercase">
                          {card.toolkit}
                        </Badge>
                      ) : null}
                      <Badge
                        variant={
                          card.statusLabel === "Ready" ? "default" : "secondary"
                        }
                      >
                        {card.statusLabel}
                      </Badge>
                    </div>
                    {card.actions.length ? (
                      <div className="text-muted-foreground">
                        <span className="text-xs font-medium">Actions:</span>{" "}
                        <span className="text-xs">
                          {card.actions.map((a, i) => (
                            <span key={a.slug}>
                              {i > 0 ? ", " : null}
                              {a.label}
                            </span>
                          ))}
                        </span>
                      </div>
                    ) : null}
                    {!remoteEnabled && card.provider === "composio" ? (
                      <p className="text-xs text-amber-600">
                        Composio actions are disabled in this environment.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {card.provider === "composio" ? (
                      <Button
                        size="sm"
                        variant={
                          card.statusLabel === "Ready" ? "outline" : "default"
                        }
                        onClick={() =>
                          handleAuthorize(
                            card.firstActionSlug || "",
                            card.toolkit
                          )
                        }
                        disabled={Boolean(authingSlug) || !formId}
                        className="gap-1"
                      >
                        <Plug className="h-3.5 w-3.5" />
                        {authingSlug === card.firstActionSlug
                          ? "Connecting…"
                          : card.statusLabel === "Ready"
                            ? "Re-authorize"
                            : "Connect"}
                      </Button>
                    ) : null}
                    {card.statusLabel === "Ready" &&
                    card.provider === "composio" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={async () => {
                          if (!formId || !card.toolkit) return
                          setSavingSlug(card.key)
                          try {
                            const res = await fetch("/api/actions/revoke", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                formId,
                                toolkit: card.toolkit,
                              }),
                            })
                            if (!res.ok) {
                              const text = await res.text()
                              throw new Error(
                                text || `Failed to disconnect (${res.status})`
                              )
                            }
                            refreshTools()
                          } catch (error) {
                            setInlineErrors((prev) => ({
                              ...prev,
                              [card.key]:
                                error instanceof Error
                                  ? error.message
                                  : String(error),
                            }))
                          } finally {
                            setSavingSlug(null)
                          }
                        }}
                        disabled={savingSlug === card.key}
                      >
                        <Power className="h-3.5 w-3.5" /> Disconnect
                      </Button>
                    ) : null}
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                    >
                      <a
                        href="https://app.formlink.ai/settings/actions"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Docs
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>

                {inlineError ? (
                  <div className="text-destructive text-xs">{inlineError}</div>
                ) : null}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </section>
  )
}

const Integrations = () => {
  const webhookUrl = useFormEditorStore(
    (state) => state.form?.settings?.integrations?.webhookUrl || ""
  )
  const updateSettingField = useFormEditorStore(
    (state) => state.updateSettingField
  )
  const [isPayloadExpanded, setIsPayloadExpanded] = useState(false)

  const handleWebhookSave = (url: string) => {
    updateSettingField("integrations", { webhookUrl: url })
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <ActionsIntegrationsSection />
      <div
        id="webhook-step"
        data-spy-section="webhook-step"
        className="flex w-full scroll-mt-8 flex-col"
      >
        <div className="mb-2 text-lg font-semibold">Setup Webhook</div>
        <Card className="p-4">
          <EditableUrlInput
            label="Webhook URL"
            enabledText="Enable webhook"
            initialValue={webhookUrl}
            onSave={handleWebhookSave}
          />
          {webhookUrl ? (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Example Payload:
                </p>
                <button
                  onClick={() => setIsPayloadExpanded(!isPayloadExpanded)}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {isPayloadExpanded ? "Show less" : "Show more"}
                </button>
              </div>
              <pre
                className={`mt-1 rounded-md bg-gray-100 p-3 text-xs whitespace-pre-wrap text-gray-800 dark:bg-gray-800 dark:text-gray-200 ${
                  isPayloadExpanded ? "max-h-none" : "max-h-20 overflow-hidden"
                }`}
              >
                {examplePayload}
              </pre>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

export default Integrations
