"use client"

import {
  SUBMISSION_HOOKS,
  type SubmissionHook,
} from "@/app/lib/intel/submission-job/types"
import { useCallback, useEffect, useMemo, useState } from "react"

export type LifecycleAllowedAction = {
  slug: string
  provider: "usesend" | "composio"
  params: Record<string, unknown>
}

export type LifecycleGuardrails = {
  skipTestmode: boolean
  maxActionsPerSubmission: number
  cooldownSeconds?: number
}

export type LifecycleConfig = {
  enabled: boolean
  guardrails: LifecycleGuardrails
  sidecarKeys?: string[]
  allowedActions: LifecycleAllowedAction[]
  orchestratorPrompt?: string
  enabledHooks?: SubmissionHook[]
  tagVocabulary?: string[]
}

const DEFAULT_CONFIG: LifecycleConfig = {
  enabled: false,
  guardrails: {
    skipTestmode: true,
    maxActionsPerSubmission: 3,
  },
  sidecarKeys: [],
  allowedActions: [],
  orchestratorPrompt: "",
  enabledHooks: [...SUBMISSION_HOOKS],
}

export function useAutomationsConfig(formId?: string) {
  const [config, setConfig] = useState<LifecycleConfig>(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(formId))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadConfig = useCallback(async () => {
    if (!formId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/forms/${formId}/lifecycle`, {
        method: "GET",
      })
      if (!res.ok) {
        throw new Error((await res.json()).error || "Failed to load config")
      }
      const json = await res.json()
      const cfg = json?.config as LifecycleConfig | undefined
      setConfig(cfg ? normalizeConfig(cfg) : DEFAULT_CONFIG)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setConfig(DEFAULT_CONFIG)
    } finally {
      setIsLoading(false)
    }
  }, [formId])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const saveConfig = useCallback(
    async (next: LifecycleConfig) => {
      if (!formId) return
      setIsSaving(true)
      setError(null)
      setConfig(next)
      try {
        const res = await fetch(`/api/forms/${formId}/lifecycle`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json?.error || "Failed to save config")
        }
        const json = await res.json().catch(() => null)
        const cfg = json?.config as LifecycleConfig | undefined
        if (cfg) setConfig(normalizeConfig(cfg))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        // Re-fetch to restore previous state
        loadConfig()
      } finally {
        setIsSaving(false)
      }
    },
    [formId, loadConfig]
  )

  const updatePartial = useCallback(
    (partial: Partial<LifecycleConfig>) => {
      const merged = normalizeConfig({
        ...config,
        ...partial,
        guardrails: {
          ...config.guardrails,
          ...(partial.guardrails || {}),
        },
      })
      return saveConfig(merged)
    },
    [config, saveConfig]
  )

  const helpers = useMemo(
    () => ({
      setEnabled: (enabled: boolean) => updatePartial({ enabled }),
      setPrompt: (orchestratorPrompt: string) =>
        updatePartial({ orchestratorPrompt }),
      syncAllowedActions: (actions: LifecycleAllowedAction[]) =>
        updatePartial({ allowedActions: actions }),
      setGuardrails: (guardrails: Partial<LifecycleGuardrails>) =>
        updatePartial({ guardrails: { ...config.guardrails, ...guardrails } }),
      setEnabledHooks: (hooks: SubmissionHook[]) => {
        const sanitized = hooks.filter((hook): hook is SubmissionHook =>
          (SUBMISSION_HOOKS as readonly string[]).includes(hook)
        )
        updatePartial({ enabledHooks: sanitized })
      },
      setTagVocabulary: (tags: string[]) => {
        const normalized = (tags || [])
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
        updatePartial({ tagVocabulary: normalized })
      },
    }),
    [config.guardrails, updatePartial]
  )

  return {
    config,
    isLoading,
    isSaving,
    error,
    reload: loadConfig,
    saveConfig,
    helpers,
  }
}

function normalizeConfig(raw: LifecycleConfig | undefined): LifecycleConfig {
  if (!raw) return DEFAULT_CONFIG
  const hooksRaw = (raw as any).enabledHooks || (raw as any).enabledTools
  const enabledHooks = Array.isArray(hooksRaw)
    ? (hooksRaw.filter((hook: any): hook is SubmissionHook =>
        (SUBMISSION_HOOKS as readonly string[]).includes(hook as string)
      ) as SubmissionHook[])
    : [...SUBMISSION_HOOKS]
  return {
    enabled: Boolean(raw.enabled),
    guardrails: {
      skipTestmode:
        raw.guardrails?.skipTestmode ?? DEFAULT_CONFIG.guardrails.skipTestmode,
      maxActionsPerSubmission:
        raw.guardrails?.maxActionsPerSubmission ??
        DEFAULT_CONFIG.guardrails.maxActionsPerSubmission,
      cooldownSeconds: raw.guardrails?.cooldownSeconds,
    },
    sidecarKeys: Array.isArray(raw.sidecarKeys) ? raw.sidecarKeys : [],
    allowedActions: Array.isArray(raw.allowedActions)
      ? raw.allowedActions.map((action) => ({
          slug: action.slug,
          provider: action.provider,
          params: action.params || {},
        }))
      : [],
    orchestratorPrompt: raw.orchestratorPrompt || "",
    enabledHooks,
    tagVocabulary: Array.isArray((raw as any).tagVocabulary)
      ? ((raw as any).tagVocabulary as string[])
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
      : undefined,
  }
}
