"use client"

import InsightPreviewCard from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/InsightPreviewCard"
import { MetaSummary } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/MetaSummary"
import { PlanHeader } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/PlanHeader"
import { Section } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/Section"
import { SetupDrawer } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDrawer"
import {
  formatActionStatus,
  requiresParamsForSlug,
} from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/utils"
import { useActionTools } from "@/app/dashboard/forms/[formId]/hooks/useActionTools"
import { useAutomationsConfig as useLifecycleConfig } from "@/app/dashboard/forms/[formId]/hooks/useAutomationsConfig"
import type { ResponseView } from "@/app/dashboard/forms/[formId]/stores/useResponseViewsStore"
import { useResponseViewsStore } from "@/app/dashboard/forms/[formId]/stores/useResponseViewsStore"
import { CURATED_ACTIONS } from "@/app/lib/actions/registry"
import {
  SUBMISSION_HOOKS,
  type SubmissionHook,
} from "@/app/lib/intel/submission-job/types"
import type { RIPlanResponse } from "@/app/lib/ri/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Switch,
  Textarea,
} from "@formlink/ui"
import { Bot, TrendingUp } from "lucide-react"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import ActionsManagerCard from "../ActionsManagerCard"

interface ResponseViewPlanProps {
  plan: RIPlanResponse
  saved?: boolean
  onSave?: () => void
  formId?: string
  onDismiss?: () => void
  onDelete?: () => void
  view?: ResponseView | null
  hideHeader?: boolean
}

export default function ResponseViewPlan(props: ResponseViewPlanProps) {
  const { plan, saved, onSave, formId, onDismiss, onDelete, view, hideHeader } =
    props
  const selectorResult = useResponseViewsStore((s) => {
    if (!formId) return null
    const id = s.activeViewIdMap[formId] || "default"
    return s.views.find((v) => v.id === id && v.formId === formId) || null
  })
  const activeView = view || selectorResult

  const viewName =
    plan?.plan?.meta?.view_name || activeView?.name || "Smart View"
  const filters: Record<string, unknown> = {
    ...(plan?.plan?.rpc?.submission_filters || {}),
    ...(plan?.plan?.rpc?.answer_filters || {}),
  }
  if (!plan?.plan?.rpc && activeView?.filters?.length) {
    for (const f of activeView.filters) {
      if (f && (f as any).id) filters[(f as any).id] = (f as any).value
    }
  }
  const columns = plan?.plan?.ui?.columns || activeView?.columns || []
  const sort = plan?.plan?.ui?.sort || activeView?.sort
  const insights = plan?.plan?.ui?.insights_spec || activeView?.insights || []

  const suggestedActions = (plan?.plan?.actions || []) as any[]
  // Separate curated actions vs. analytics pseudo-actions
  const curatedSlugs = React.useMemo(
    () => new Set(CURATED_ACTIONS.map((a) => a.slug)),
    []
  )
  type AnalyticsKey = SubmissionHook
  const normalizeAnalyticsKey = (s: string): AnalyticsKey | null => {
    const k = s.toLowerCase().replace(/\s+/g, "")
    if (k.startsWith("spam")) return "spam"
    if (k.startsWith("enrich")) return "enrichment"
    if (k.startsWith("lead")) return "lead"
    if (k.startsWith("tag")) return "tags"
    return null
  }
  const analyticsSuggested = new Set<AnalyticsKey>()
  const unsupportedAnalytics = new Set<string>()
  const actions = suggestedActions.filter((action) => {
    const key = String(action?.action_key || "")
    if (!key) return false
    if (curatedSlugs.has(key)) return true
    const maybe = normalizeAnalyticsKey(key)
    if (maybe) {
      analyticsSuggested.add(maybe)
      return false
    }
    unsupportedAnalytics.add(key)
    return false
  })
  const rationale = plan?.plan?.meta?.rationale || activeView?.description

  const shouldLoadActions = Boolean(formId && actions.length)
  const {
    tools,
    isLoading: loadingActions,
    error: toolsError,
    enabled: remoteActionsEnabled,
    refresh: refreshTools,
  } = useActionTools({
    formId,
    enabled: shouldLoadActions,
    viewId: activeView?.saved ? activeView.id : undefined,
  })
  const refreshConfigs = () => {}

  const actionItems = useMemo(() => {
    if (!actions.length) return []
    const seen = new Set<string>()
    return actions
      .filter((action) => {
        const k = action.action_key
        if (!k || seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map((action) => {
        const slug = action.action_key
        const tool = tools.find((candidate) => candidate.slug === slug)
        const provider = action.provider || tool?.provider || "composio"
        const label = action.title || tool?.label || slug
        const toolkit =
          tool?.toolkit || slug.split("_")[0]?.toLowerCase() || undefined
        // Derive auth label purely from tool.authStatus/global integration
        let status = tool
          ? formatActionStatus(
              tool.authStatus || "unknown",
              provider,
              remoteActionsEnabled
            )
          : formId
            ? remoteActionsEnabled
              ? provider === "composio"
                ? "Needs auth"
                : "Unavailable"
              : "Integration disabled"
            : "Suggested"
        if (provider === "usesend") status = "Ready"

        const needsParams = requiresParamsForSlug(slug)
        // Per‑view configuration only (ignore global configured/uiStatus from tools)
        const configuredFromView = Boolean(
          (activeView as any)?.actions?.some(
            (a: any) =>
              a?.slug === slug &&
              a?.params &&
              Object.keys(a.params || {}).length > 0
          )
        )
        const configured = needsParams ? configuredFromView : true
        const configLabel =
          provider === "composio"
            ? configured
              ? "Configured"
              : needsParams
                ? "Needs params"
                : undefined
            : undefined

        // uiStatus derived only from view params + auth
        let uiStatus: undefined | "ready" | "needs_auth" | "needs_setup"
        const lowered = String((tool?.authStatus || "").toLowerCase())
        const authReady =
          provider === "usesend" ||
          lowered === "ready" ||
          lowered === "connected"
        if (provider === "usesend") uiStatus = "ready"
        else if (!remoteActionsEnabled && provider === "composio")
          uiStatus = "needs_auth"
        else if (!authReady) uiStatus = "needs_auth"
        else if (needsParams && !configured) uiStatus = "needs_setup"
        else uiStatus = "ready"

        return {
          slug,
          label,
          provider,
          toolkit,
          status,
          configured,
          configLabel,
          toolSlug: tool?.slug || slug,
          toolLabel: tool?.label || undefined,
          uiStatus,
        }
      })
  }, [actions, tools, remoteActionsEnabled, formId])

  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string>("")

  const highlightClass = saved
    ? "mb-4 !bg-transparent rounded-none border-0 shadow-none"
    : "mb-4 !bg-transparent rounded-none border-0 shadow-none"

  const isDefaultView =
    !activeView ||
    activeView.id === "default" ||
    Boolean((activeView as any)?.is_default)
  const {
    config: lifecycleConfig,
    isLoading: lifecycleLoading,
    isSaving: lifecycleSaving,
    error: lifecycleError,
    helpers: lifecycleHelpers,
  } = useLifecycleConfig(isDefaultView ? formId : undefined)

  const [promptDraft, setPromptDraft] = useState(
    lifecycleConfig.orchestratorPrompt || ""
  )

  const { list: enabledHooks, set: enabledHookSet } = useMemo(() => {
    const list =
      lifecycleConfig.enabledHooks === undefined
        ? [...SUBMISSION_HOOKS]
        : (lifecycleConfig.enabledHooks as SubmissionHook[])
    return {
      list,
      set: new Set<SubmissionHook>(list),
    }
  }, [lifecycleConfig.enabledHooks])
  const analyticsOptions: Array<{
    key: SubmissionHook
    label: string
    description: string
  }> = useMemo(
    () => [
      {
        key: "spam",
        label: "Spam detection",
        description: "Score spam likelihood and capture notable flags.",
      },
      {
        key: "enrichment",
        label: "Enrichment",
        description: "Infer email, domain, and company details from answers.",
      },
      {
        key: "lead",
        label: "Lead scoring",
        description: "Assign lead score (0-100) and tier (A-D).",
      },
      {
        key: "tags",
        label: "Tag suggestion",
        description: "Add topical tags like demo_request or urgent.",
      },
    ],
    []
  )
  const [tagVocabDraft, setTagVocabDraft] = useState(
    (lifecycleConfig as any)?.tagVocabulary?.join(",") || ""
  )
  const [tagVocabError, setTagVocabError] = useState<string | null>(null)
  const [showTagVocabEditor, setShowTagVocabEditor] = useState(false)

  // Actions editor moved to Automation Plan drawer; removed local dialog/debug.

  useEffect(() => {
    setPromptDraft(lifecycleConfig.orchestratorPrompt || "")
  }, [lifecycleConfig.orchestratorPrompt])

  useEffect(() => {
    const vocab = (lifecycleConfig as any)?.tagVocabulary
    setTagVocabDraft(Array.isArray(vocab) ? vocab.join(",") : "")
  }, [(lifecycleConfig as any)?.tagVocabulary])

  const handleToggleTool = useCallback(
    (hook: SubmissionHook, checked: boolean) => {
      const next = new Set<SubmissionHook>(enabledHookSet)
      if (checked) {
        const vocabArray = (lifecycleConfig as any)?.tagVocabulary as
          | string[]
          | undefined
        const hasSavedVocab = Array.isArray(vocabArray) && vocabArray.length > 0
        if (
          hook === "tags" &&
          !hasSavedVocab &&
          parseTagDraft(tagVocabDraft).length === 0
        ) {
          setTagVocabError(
            "Enter at least one allowed tag to enable auto‑tagging."
          )
          setShowTagVocabEditor(true)
          return
        }
        next.add(hook)
      } else {
        next.delete(hook)
      }
      lifecycleHelpers.setEnabledHooks(Array.from(next) as SubmissionHook[])
      if (checked && !lifecycleConfig.enabled) {
        lifecycleHelpers.setEnabled(true)
      }
    },
    [enabledHookSet, lifecycleHelpers, lifecycleConfig.enabled]
  )

  const syncActionsFromPlan = () => {
    if (!plan?.plan?.actions?.length || !formId) return
    const allowed = (plan.plan.actions as any[]).map((action) => ({
      slug: action.action_key,
      provider: (action.provider || "composio") as "usesend" | "composio",
      params: (action.params as Record<string, unknown>) || {},
    }))
    lifecycleHelpers.syncAllowedActions(allowed)
  }

  const onToggleFactory = useCallback(
    (key: SubmissionHook) => (value: boolean) =>
      handleToggleTool(key, Boolean(value)),
    [handleToggleTool]
  )

  return (
    <>
      <Card className={highlightClass}>
        {!hideHeader ? (
          <PlanHeader viewName={viewName} saved={saved} onDismiss={onDismiss} />
        ) : null}
        <CardContent className="space-y-4 text-sm">
          {isDefaultView && formId ? (
            <LifecycleAutomationsSection
              plan={plan}
              lifecycleConfig={lifecycleConfig}
              lifecycleLoading={lifecycleLoading}
              lifecycleSaving={lifecycleSaving}
              lifecycleError={lifecycleError}
              lifecycleHelpers={lifecycleHelpers}
              promptDraft={promptDraft}
              setPromptDraft={setPromptDraft}
              analyticsOptions={analyticsOptions}
              enabledHookSet={enabledHookSet}
              onToggleFactory={onToggleFactory}
              tagVocabDraft={tagVocabDraft}
              setTagVocabDraft={setTagVocabDraft}
              tagVocabError={tagVocabError}
              setTagVocabError={setTagVocabError}
              showTagVocabEditor={showTagVocabEditor}
              setShowTagVocabEditor={setShowTagVocabEditor}
              analyticsSuggested={analyticsSuggested}
              unsupportedAnalytics={unsupportedAnalytics}
              syncActionsFromPlan={syncActionsFromPlan}
            />
          ) : null}
          <MetaSummary
            rationale={rationale}
            filters={filters}
            columns={columns}
            sort={sort}
            formId={formId}
          />

          <div className="space-y-2">
            <Section
              title="Insights"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
            >
              {insights.length ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {insights.map((ins: any, i: number) => (
                    <InsightPreviewCard key={i} spec={ins} />
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </Section>

            <ActionsManagerCard
              formId={formId!}
              mode="view"
              showHeader={true}
              actions={(plan?.plan?.actions || []).map((action: any) => ({
                slug: action?.action_key,
                provider: (action?.provider || "composio") as
                  | "usesend"
                  | "composio",
                params: (action?.params as Record<string, unknown>) || {},
              }))}
            />
          </div>
        </CardContent>
      </Card>

      <SetupDrawer
        open={Boolean(openSlug)}
        onOpenChange={(v) => {
          if (!v) setOpenSlug(null)
        }}
        openSlug={openSlug}
        setOpenSlug={setOpenSlug}
        actionItems={actionItems as any}
        formId={formId}
        activeView={activeView as any}
        refreshTools={refreshTools}
        refreshConfigs={refreshConfigs}
        configs={[] as any}
        setAuthingSlug={() => {}}
      />
      {/* Actions editor moved into Automation Plan drawer (SubmissionAutomationsCard) */}
    </>
  )
}

// mini chart removed; using InsightPreviewCard

type AnalyticsOption = {
  key: SubmissionHook
  label: string
  description: string
}

interface LifecycleAutomationsSectionProps {
  plan: RIPlanResponse
  lifecycleConfig: ReturnType<typeof useLifecycleConfig>["config"]
  lifecycleLoading: boolean
  lifecycleSaving: boolean
  lifecycleError: string | null
  lifecycleHelpers: ReturnType<typeof useLifecycleConfig>["helpers"]
  promptDraft: string
  setPromptDraft: (s: string) => void
  analyticsOptions: AnalyticsOption[]
  enabledHookSet: Set<SubmissionHook>
  onToggleFactory: (key: SubmissionHook) => (value: boolean) => void
  tagVocabDraft: string
  setTagVocabDraft: (s: string) => void
  tagVocabError: string | null
  setTagVocabError: (s: string | null) => void
  showTagVocabEditor: boolean
  setShowTagVocabEditor: (b: boolean) => void
  analyticsSuggested: Set<SubmissionHook>
  unsupportedAnalytics: Set<string>
  syncActionsFromPlan: () => void
}

function LifecycleAutomationsSection(props: LifecycleAutomationsSectionProps) {
  const {
    plan,
    lifecycleConfig,
    lifecycleLoading,
    lifecycleSaving,
    lifecycleError,
    lifecycleHelpers,
    promptDraft,
    setPromptDraft,
    analyticsOptions,
    enabledHookSet,
    onToggleFactory,
    tagVocabDraft,
    setTagVocabDraft,
    tagVocabError,
    setTagVocabError,
    showTagVocabEditor,
    setShowTagVocabEditor,
    analyticsSuggested,
    unsupportedAnalytics,
    syncActionsFromPlan,
  } = props

  return (
    <Section
      title="Submission Automations"
      icon={<Bot className="h-3.5 w-3.5" />}
    >
      <div className="grid gap-3 pt-3">
        <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Automation Rules
        </label>
        <Textarea
          value={promptDraft}
          onChange={(event) => setPromptDraft(event.target.value)}
          onBlur={() => lifecycleHelpers.setPrompt(promptDraft)}
          placeholder="Example: If spam.score < 0.8 and lead.tier = A, email sales."
          rows={3}
          disabled={lifecycleLoading || lifecycleSaving}
        />

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Submission Hooks
          </p>
          <SubmissionHooksList
            options={analyticsOptions}
            enabledHookSet={enabledHookSet}
            makeHandler={onToggleFactory}
            disabled={lifecycleLoading || lifecycleSaving}
          />

          {enabledHookSet.has("tags") || showTagVocabEditor ? (
            <TagVocabEditor
              tagVocabDraft={tagVocabDraft}
              setTagVocabDraft={setTagVocabDraft}
              tagVocabError={tagVocabError}
              setTagVocabError={setTagVocabError}
              lifecycleSaving={lifecycleSaving}
              lifecycleLoading={lifecycleLoading}
              lifecycleConfigEnabled={lifecycleConfig.enabled}
              enabledHookSet={enabledHookSet}
              setShowTagVocabEditor={setShowTagVocabEditor}
              lifecycleHelpers={lifecycleHelpers}
            />
          ) : (
            <div className="text-muted-foreground text-[11px]">
              Allowed tags:{" "}
              {((lifecycleConfig as any)?.tagVocabulary || []).length}{" "}
              configured
            </div>
          )}

          {analyticsSuggested.size ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-muted-foreground text-xs">
                Suggested checks:
              </span>
              {Array.from(analyticsSuggested).map((k) => (
                <Badge
                  key={k}
                  variant="outline"
                  className="bg-primary/5 text-primary"
                >
                  {k}
                </Badge>
              ))}
              <Button
                size="sm"
                variant="secondary"
                disabled={lifecycleSaving || !lifecycleConfig.enabled}
                onClick={() =>
                  lifecycleHelpers.setEnabledHooks(
                    Array.from(
                      new Set<SubmissionHook>([
                        ...enabledHookSet,
                        ...Array.from(analyticsSuggested),
                      ])
                    ) as SubmissionHook[]
                  )
                }
              >
                Enable suggested
              </Button>
            </div>
          ) : null}
          {unsupportedAnalytics.size ? (
            <p className="text-muted-foreground text-[11px]">
              Ignored non-action suggestions:{" "}
              {Array.from(unsupportedAnalytics).join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Allowed actions
          </p>
          {lifecycleConfig.allowedActions.length ? (
            <div className="space-y-2">
              {lifecycleConfig.allowedActions.map((action) => (
                <div
                  key={action.slug}
                  className="flex items-center justify-between gap-3 rounded-md border p-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {action.slug}
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      Provider: {action.provider}
                    </div>
                  </div>
                  <Switch
                    checked
                    onCheckedChange={(v) => {
                      if (!v) {
                        const next = lifecycleConfig.allowedActions.filter(
                          (a) => a.slug !== action.slug
                        )
                        lifecycleHelpers.syncAllowedActions(next)
                      }
                    }}
                    disabled={lifecycleSaving}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              No actions configured.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {plan?.plan?.actions?.length ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={lifecycleSaving}
              onClick={syncActionsFromPlan}
            >
              Sync from plan
            </Button>
          ) : null}
        </div>
      </div>
      {lifecycleError ? (
        <p className="text-destructive text-xs">{lifecycleError}</p>
      ) : null}
    </Section>
  )
}

interface SubmissionHooksListProps {
  options: AnalyticsOption[]
  enabledHookSet: Set<SubmissionHook>
  makeHandler: (key: SubmissionHook) => (value: boolean) => void
  disabled?: boolean
}

const SubmissionHooksList = React.memo(function SubmissionHooksList({
  options,
  enabledHookSet,
  makeHandler,
  disabled,
}: SubmissionHooksListProps) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const checked = enabledHookSet.has(option.key)
        return (
          <div
            key={option.key}
            className="border-dashed/70 flex items-start justify-between gap-4 rounded-md border p-3"
          >
            <div>
              <p className="text-sm font-medium">{option.label}</p>
              <p className="text-muted-foreground text-xs">
                {option.description}
              </p>
            </div>
            <Switch
              checked={checked}
              disabled={disabled}
              onCheckedChange={(value) =>
                makeHandler(option.key)(Boolean(value))
              }
            />
          </div>
        )
      })}
    </div>
  )
})

interface TagVocabEditorProps {
  tagVocabDraft: string
  setTagVocabDraft: (s: string) => void
  tagVocabError: string | null
  setTagVocabError: (s: string | null) => void
  lifecycleSaving: boolean
  lifecycleLoading: boolean
  lifecycleConfigEnabled: boolean
  enabledHookSet: Set<SubmissionHook>
  setShowTagVocabEditor: (b: boolean) => void
  lifecycleHelpers: ReturnType<typeof useLifecycleConfig>["helpers"]
}

const TagVocabEditor = React.memo(function TagVocabEditor(
  props: TagVocabEditorProps
) {
  const {
    tagVocabDraft,
    setTagVocabDraft,
    tagVocabError,
    setTagVocabError,
    lifecycleSaving,
    lifecycleLoading,
    lifecycleConfigEnabled,
    enabledHookSet,
    setShowTagVocabEditor,
    lifecycleHelpers,
  } = props
  const onSave = useCallback(async () => {
    const tags = parseTagDraft(tagVocabDraft)
    if (!tags.length) {
      setTagVocabError("Add at least one tag")
      return
    }
    await (lifecycleHelpers as any).setTagVocabulary?.(tags)
    setTagVocabError(null)
    setShowTagVocabEditor(false)
    if (!enabledHookSet.has("tags")) {
      const next = new Set<SubmissionHook>(enabledHookSet)
      next.add("tags")
      await lifecycleHelpers.setEnabledHooks(
        Array.from(next) as SubmissionHook[]
      )
    }
    if (!lifecycleConfigEnabled) {
      await lifecycleHelpers.setEnabled(true)
    }
  }, [
    enabledHookSet,
    lifecycleConfigEnabled,
    lifecycleHelpers,
    setShowTagVocabEditor,
    setTagVocabError,
    tagVocabDraft,
  ])
  return (
    <div className="space-y-2">
      <label className="text-xs">
        Allowed Tags (required for Auto‑tagging)
      </label>
      <div className="flex items-start gap-2">
        <Input
          value={tagVocabDraft}
          onChange={(e) => {
            setTagVocabDraft(e.target.value)
            if (tagVocabError) setTagVocabError(null)
          }}
          placeholder="pricing,demo_request,enterprise,bug"
          disabled={lifecycleSaving || lifecycleLoading}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={lifecycleSaving || lifecycleLoading}
          onClick={onSave}
        >
          Save tags
        </Button>
      </div>
      {tagVocabError ? (
        <div className="text-destructive text-xs">{tagVocabError}</div>
      ) : null}
      <div className="text-muted-foreground text-[11px]">
        Enter a comma‑separated list; tags are lowercased and limited to 1–3
        words.
      </div>
    </div>
  )
})

function parseTagDraft(input: string): string[] {
  return (input || "")
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((t) => t.length > 0 && t.split(" ").length <= 3)
}
