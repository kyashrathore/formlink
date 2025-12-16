import type { ActionToolSummary } from "@/app/lib/actions/api-types"
import { useCallback, useEffect, useMemo, useState } from "react"

interface UseActionToolsOptions {
  formId?: string
  search?: string
  toolkits?: string[]
  limit?: number
  enabled?: boolean
  viewId?: string
}

interface UseActionToolsResult {
  tools: ActionToolSummary[]
  isLoading: boolean
  error: Error | null
  enabled: boolean
  refresh: () => void
}

export function useActionTools({
  formId,
  search,
  toolkits,
  limit,
  enabled = true,
  viewId,
}: UseActionToolsOptions): UseActionToolsResult {
  const [tools, setTools] = useState<ActionToolSummary[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [remoteEnabled, setRemoteEnabled] = useState<boolean>(true)
  const [nonce, setNonce] = useState<number>(0)

  const payload = useMemo(() => {
    // If enabled is true, we proceed even without formId (global mode)
    // But if caller specifically wants form validation, they should handle it.
    // The previous check was `if (!formId) return null`.
    // We now allow it.
    return {
      formId,
      search,
      toolkits,
      limit,
      viewId,
    }
  }, [formId, search, limit, viewId, JSON.stringify(toolkits || [])])

  useEffect(() => {
    if (!enabled || !payload) {
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch("/api/actions/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Tools request failed (${res.status})`)
        }
        return res.json() as Promise<{
          success: boolean
          tools?: ActionToolSummary[]
          enabled?: boolean
        }>
      })
      .then((json) => {
        if (cancelled) return
        setRemoteEnabled(json.enabled !== false)
        setTools(json.tools || [])
        setIsLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, payload ? JSON.stringify(payload) : null, nonce])

  const refresh = useCallback(() => {
    setNonce((value) => value + 1)
  }, [])

  return {
    tools,
    isLoading,
    error,
    enabled: remoteEnabled,
    refresh,
  }
}
