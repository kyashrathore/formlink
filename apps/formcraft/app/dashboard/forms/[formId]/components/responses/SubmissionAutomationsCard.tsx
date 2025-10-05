"use client"

// Using absolute alias to avoid fragile relative path resolution
import ActionsManagerCard from "@/app/dashboard/forms/[formId]/components/responses/ActionsManagerCard"
import { SetupDrawer } from "@/app/dashboard/forms/[formId]/components/responses/ResponseViewPlan/SetupDrawer"
import { useActionTools } from "@/app/dashboard/forms/[formId]/hooks/useActionTools"
import {
  useAutomationsConfig,
  type LifecycleAllowedAction,
} from "@/app/dashboard/forms/[formId]/hooks/useAutomationsConfig"
import { CURATED_ACTIONS } from "@/app/lib/actions/registry"
import type { SubmissionHook } from "@/app/lib/intel/submission-job/types"
import { SUBMISSION_HOOKS } from "@/app/lib/intel/submission-job/types"
import type { LifecyclePlanProposal } from "@/app/lib/lifecycle/plan-types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Switch,
  Textarea,
} from "@formlink/ui"
import { useEffect, useMemo, useState } from "react"

const HOOK_LABELS: Record<SubmissionHook, string> = {
  spam: "Spam check",
  enrichment: "Enrichment",
  lead: "Lead score",
  tags: "Auto‑tagging",
}

const HOOK_DESCRIPTIONS: Record<SubmissionHook, string> = {
  spam: "Scores spam 0–1; you can block actions above a threshold.",
  enrichment: "Derives email/company/domain from answers.",
  lead: "Assigns lead score (0–100) and tier (A–D).",
  tags: "Suggests topical tags for each submission.",
}

interface SubmissionAutomationsCardProps {
  formId: string
  plan?: LifecyclePlanProposal
  onDismiss?: () => void
}

export function SubmissionAutomationsCard(
  props: SubmissionAutomationsCardProps
) {
  const { formId, plan, onDismiss } = props
  const { config, helpers, isSaving } = useAutomationsConfig(formId)

  const proposed = (plan?.proposal as any) || {
    allowedActions: [],
    enabledHooks: [],
    orchestratorPrompt: "",
    rationale: "",
  }
  const curated = useMemo(
    () => new Map(CURATED_ACTIONS.map((a) => [a.slug, a])),
    []
  )
  const proposedActions: LifecycleAllowedAction[] = Array.isArray(
    (proposed as any).allowedActions
  )
    ? ((proposed as any).allowedActions as any[]).map((a: any) => ({
        slug: a.slug,
        provider: a.provider,
        params: a.params || {},
      }))
    : []
  const proposedHooks: SubmissionHook[] = Array.isArray(
    (proposed as any).enabledHooks
  )
    ? (((proposed as any).enabledHooks as any[]).filter((h) =>
        (SUBMISSION_HOOKS as readonly string[]).includes(h as string)
      ) as SubmissionHook[])
    : []
  // State (defined before effects)
  const [promptDraft, setPromptDraft] = useState(
    (proposed as any).orchestratorPrompt || config.orchestratorPrompt || ""
  )
  const [enableAgent, setEnableAgent] = useState<boolean>(
    Boolean(config.enabled)
  )
  const [tagVocabDraft, setTagVocabDraft] = useState(
    (config.tagVocabulary || []).join(",")
  )
  const [showTagVocabEditor, setShowTagVocabEditor] = useState(false)
  const [tagVocabError, setTagVocabError] = useState<string | null>(null)

  // Inline Allowed Actions editor (merges prior SubmissionActionsDialog into this drawer)
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const { tools, refresh: refreshTools } = useActionTools({
    formId,
    enabled: Boolean(formId),
  })

  // Remove legacy local drafts editor in favor of unified ActionsManagerCard

  // Sync draft when config updates (so saved tags appear)
  useEffect(() => {
    setTagVocabDraft((config.tagVocabulary || []).join(","))
  }, [config.tagVocabulary])

  const applyAll = async () => {
    if (!formId) return
    if (typeof proposed.orchestratorPrompt === "string") {
      await helpers.setPrompt(proposed.orchestratorPrompt)
    }
    if (Array.isArray((proposed as any).enabledHooks)) {
      await helpers.setEnabledHooks((proposed as any).enabledHooks as any)
    }
    if (Array.isArray(proposedActions) && proposedActions.length) {
      await helpers.syncAllowedActions(proposedActions)
    }
    if (!config.enabled && enableAgent) {
      await helpers.setEnabled(true)
    }
    onDismiss?.()
  }

  return (
    <Card className="rounded-none border-0 !bg-transparent shadow-none">
      <CardContent className="space-y-4 p-0 text-sm">
        {/* Header moved into ActionsManagerCard */}

        <ActionsManagerCard
          formId={formId}
          mode="lifecycle"
          actions={proposedActions}
        />

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Automation Rules</Label>
          <Textarea
            value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value)}
            onBlur={() => helpers.setPrompt(promptDraft)}
            rows={3}
            disabled={isSaving}
            placeholder="Example: If spam.score < 0.8 and lead.tier = A, email sales."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Submission Hooks</Label>
          <div className="space-y-2">
            {SUBMISSION_HOOKS.map((hook) => {
              const enabled = new Set(config.enabledHooks || []).has(hook)
              const label = HOOK_LABELS[hook as SubmissionHook]
              const description = HOOK_DESCRIPTIONS[hook as SubmissionHook]
              const isProposed = proposedHooks.includes(hook)
              return (
                <div
                  key={hook}
                  className="border-dashed/70 flex items-start justify-between gap-4 rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {label}
                      {isProposed ? (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Proposed
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {description}
                    </p>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={isSaving}
                    onCheckedChange={(v) => {
                      const set = new Set(config.enabledHooks || [])
                      if (hook === "tags" && v) {
                        const currentVocab = config.tagVocabulary || []
                        const draftParsed = parseTagDraft(tagVocabDraft)
                        if (!currentVocab.length && !draftParsed.length) {
                          setShowTagVocabEditor(true)
                          setTagVocabError(
                            "Enter at least one allowed tag to enable auto‑tagging."
                          )
                          return
                        }
                        set.add(hook)
                      } else {
                        if (v) set.add(hook)
                        else set.delete(hook)
                      }
                      helpers.setEnabledHooks(
                        Array.from(set) as SubmissionHook[]
                      )
                      if (v && !config.enabled) {
                        helpers.setEnabled(true)
                      }
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Tag vocabulary editor — only when Tag hook enabled or gating triggered */}
        {new Set(config.enabledHooks || []).has("tags") ||
        showTagVocabEditor ? (
          <div className="space-y-2">
            <Label className="text-xs">
              Allowed Tags (required for Auto‑tagging)
            </Label>
            <div className="flex items-start gap-2">
              <Input
                value={tagVocabDraft}
                onChange={(e) => {
                  setTagVocabDraft(e.target.value)
                  if (tagVocabError) setTagVocabError(null)
                }}
                placeholder="pricing,demo_request,enterprise,bug"
                disabled={isSaving}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  const tags = parseTagDraft(tagVocabDraft)
                  if (!tags.length) {
                    setTagVocabError("Add at least one tag")
                    return
                  }
                  await helpers.setTagVocabulary(tags)
                  setShowTagVocabEditor(false)
                  setTagVocabError(null)
                  // Ensure Tag hook enabled now that vocab exists
                  const enabledSet = new Set(config.enabledHooks || [])
                  if (!enabledSet.has("tags")) {
                    enabledSet.add("tags")
                    await helpers.setEnabledHooks(
                      Array.from(enabledSet) as SubmissionHook[]
                    )
                  }
                  if (!config.enabled) await helpers.setEnabled(true)
                }}
                disabled={isSaving}
              >
                Save tags
              </Button>
            </div>
            {tagVocabError ? (
              <div className="text-destructive text-xs">{tagVocabError}</div>
            ) : null}
            <div className="text-muted-foreground text-[11px]">
              Enter a comma‑separated list; tags will be lowercased and limited
              to 1–3 words.
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-[11px]">
            Allowed tags: {(config.tagVocabulary || []).length} configured
          </div>
        )}

        {/* Removed master switch per request; enabling any hook ensures automations run. */}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            disabled={isSaving}
          >
            Dismiss
          </Button>
          <Button
            type="button"
            onClick={applyAll}
            disabled={isSaving || !formId}
          >
            Apply
          </Button>
        </div>

        {/* Setup dialog (auth + params). Lives inside this drawer to keep scoping. */}
        <SetupDrawer
          open={Boolean(openSlug)}
          onOpenChange={(v) => {
            if (!v) setOpenSlug(null)
          }}
          openSlug={openSlug}
          setOpenSlug={setOpenSlug}
          actionItems={useMemo(() => {
            const configured = (config.allowedActions ||
              []) as LifecycleAllowedAction[]
            const configuredSlugs = new Set(configured.map((a) => a.slug))
            const proposedOnly = proposedActions.filter(
              (a) => !configuredSlugs.has(a.slug)
            )
            const union = [
              ...configured.map((a) => ({
                slug: a.slug,
                provider: a.provider as any,
                params: a.params,
              })),
              ...proposedOnly.map((a) => ({
                slug: a.slug,
                provider: a.provider as any,
                params: a.params,
              })),
            ]
            return union.map((a) => ({
              slug: a.slug,
              label: curated.get(a.slug)?.label || a.slug,
              provider: a.provider as any,
              toolkit: curated.get(a.slug)?.toolkit,
              status: String(
                tools.find((t) => t.slug === a.slug)?.authStatus || "unknown"
              ),
              configured: Boolean(
                a.params && Object.keys(a.params || {}).length
              ),
              uiStatus: undefined,
            }))
          }, [config.allowedActions, curated, proposedActions, tools])}
          formId={formId}
          activeView={null}
          refreshTools={refreshTools}
          refreshConfigs={() => {}}
          configs={[] as any}
          setAuthingSlug={() => {}}
        />
      </CardContent>
    </Card>
  )
}

export default SubmissionAutomationsCard

// Local helpers — keep in this file to avoid new shared deps
function parseTagDraft(input: string): string[] {
  return (input || "")
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((t) => t.length > 0 && t.split(" ").length <= 3)
}
