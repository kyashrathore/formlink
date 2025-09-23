import { Composio } from "@composio/core"
import { ActionExecutionError } from "./errors"
import {
  ComposioAuthLink,
  ComposioConnectionStatus,
  ComposioEnsureAuthArgs,
  ComposioExecuteArgs,
  ComposioGetArgs,
  ComposioSearchArgs,
  ComposioToolAuthState,
  ComposioToolSummary,
  ComposioWaitForConnectionArgs,
} from "./types"

interface ComposioClientConfig {
  apiKey: string
  baseUrl?: string
  autoHandleFiles?: boolean
}

const DEFAULT_BASE_URL = process.env.COMPOSIO_BASE_URL?.replace(/\/$/, "")

class ComposioHttpClient {
  private readonly sdk: Composio

  constructor({
    apiKey,
    baseUrl,
    autoHandleFiles = false,
  }: ComposioClientConfig) {
    const init: Record<string, unknown> = {
      apiKey,
      autoHandleFiles,
    }
    if (baseUrl) {
      init.baseUrl = baseUrl
    }
    this.sdk = new Composio(init)
  }

  private normaliseTools(result: unknown): ComposioToolSummary[] {
    if (!result) return []
    const payload = result as any
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.tools))
      return payload.tools as ComposioToolSummary[]
    if (Array.isArray(payload?.data))
      return payload.data as ComposioToolSummary[]
    return []
  }

  private normaliseAuthStates(result: unknown): ComposioToolAuthState[] {
    if (!result) return []
    const payload = result as any
    if (Array.isArray(payload)) return payload as ComposioToolAuthState[]
    if (Array.isArray(payload?.states))
      return payload.states as ComposioToolAuthState[]
    return []
  }

  private missingMethodError(method: string): never {
    throw new ActionExecutionError(
      `Composio SDK does not implement ${method}`,
      {
        status: 500,
        provider: "composio",
      }
    )
  }

  private async callSdkSafely<T>(
    label: string,
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      throw new ActionExecutionError(`Composio ${label} failed: ${msg}`, {
        status: 502,
        provider: "composio",
        cause: error,
      })
    }
  }

  async searchTools(args: ComposioSearchArgs) {
    // SDK public API exposes composio.tools.get(userId, { search, ... })
    const method = (this.sdk as any)?.tools?.get
    if (typeof method !== "function") {
      this.missingMethodError("tools.get")
    }
    const { userId, query, toolkits, limit } = args
    const result = await this.callSdkSafely("tools.get", () =>
      method.call(this.sdk.tools, userId, {
        search: query,
        toolkits,
        limit,
      })
    )
    return this.normaliseTools(result)
  }

  async getTools(args: ComposioGetArgs) {
    // SDK public API exposes composio.tools.get(userId, { toolkits, scopes, limit })
    const method = (this.sdk as any)?.tools?.get
    if (typeof method !== "function") {
      this.missingMethodError("tools.get")
    }
    const { userId, toolkits, scopes, limit } = args
    const result = await this.callSdkSafely("tools.get", () =>
      method.call(this.sdk.tools, userId, {
        toolkits,
        scopes,
        limit,
      })
    )
    return this.normaliseTools(result)
  }

  async executeTool({ toolSlug, userId, args }: ComposioExecuteArgs) {
    const method = (this.sdk as any)?.tools?.execute
    if (typeof method !== "function") {
      this.missingMethodError("tools.execute")
    }
    // Prefer documented TS signature first: execute(slug, { userId, arguments })
    try {
      const executionDoc = await this.callSdkSafely(
        "tools.execute (slug, options)",
        () => method.call(this.sdk.tools, toolSlug, { userId, arguments: args })
      )
      const providerReference =
        (executionDoc as any)?.reference || (executionDoc as any)?.id
      const data = (executionDoc as any)?.result ?? executionDoc
      return { providerReference, data }
    } catch (_) {
      // Try object signature with `arguments`
      try {
        const executionObj = await this.callSdkSafely(
          "tools.execute (obj)",
          () =>
            method.call(this.sdk.tools, {
              tool: toolSlug,
              userId,
              arguments: args,
            })
        )
        const providerReference =
          (executionObj as any)?.reference || (executionObj as any)?.id
        const data = (executionObj as any)?.result ?? executionObj
        return { providerReference, data }
      } catch {
        // Try (userId, obj) signature with `arguments`
        const executionUserObj = await this.callSdkSafely(
          "tools.execute (userId, obj)",
          () =>
            method.call(this.sdk.tools, userId, {
              tool: toolSlug,
              arguments: args,
            })
        )
        const providerReference =
          (executionUserObj as any)?.reference || (executionUserObj as any)?.id
        const data = (executionUserObj as any)?.result ?? executionUserObj
        return { providerReference, data }
      }
    }
  }

  async ensureAuth({
    userId,
    authConfigId,
    callbackUrl,
  }: ComposioEnsureAuthArgs) {
    const linked = (this.sdk as any)?.connectedAccounts?.link
    const initiated = (this.sdk as any)?.connectedAccounts?.initiate

    // Helper to normalize different SDK response shapes
    const normalize = (raw: unknown): ComposioAuthLink => {
      const anyRes = raw as any
      return {
        redirectUrl:
          anyRes?.redirectUrl ||
          anyRes?.url ||
          anyRes?.link ||
          anyRes?.redirect_url ||
          undefined,
        connectionRequestId:
          anyRes?.connectionRequestId ||
          anyRes?.id ||
          anyRes?.requestId ||
          anyRes?.request_id,
      }
    }

    // Try connectedAccounts.link with both possible signatures
    if (typeof linked === "function") {
      // Signature A: link({ userId, authConfigId, callbackUrl })
      try {
        const resA = await this.callSdkSafely(
          "connectedAccounts.link (obj)",
          () =>
            linked.call(this.sdk.connectedAccounts, {
              userId,
              authConfigId,
              callbackUrl,
            })
        )
        return normalize(resA)
      } catch (_) {
        // Try with redirectUrl instead of callbackUrl
        try {
          const resARedirect = await this.callSdkSafely(
            "connectedAccounts.link (obj, redirectUrl)",
            () =>
              linked.call(this.sdk.connectedAccounts, {
                userId,
                authConfigId,
                redirectUrl: callbackUrl,
              })
          )
          return normalize(resARedirect)
        } catch {
          // Signature B: link(userId, authConfigId, { callbackUrl })
          try {
            const resB = await this.callSdkSafely(
              "connectedAccounts.link (positional)",
              () =>
                linked.call(this.sdk.connectedAccounts, userId, authConfigId, {
                  callbackUrl,
                })
            )
            return normalize(resB)
          } catch {
            // Signature B with redirectUrl
            try {
              const resBRedirect = await this.callSdkSafely(
                "connectedAccounts.link (positional, redirectUrl)",
                () =>
                  linked.call(
                    this.sdk.connectedAccounts,
                    userId,
                    authConfigId,
                    {
                      redirectUrl: callbackUrl,
                    }
                  )
              )
              return normalize(resBRedirect)
            } catch {
              // fall through to initiate
            }
          }
        }
      }
    }

    // Try connectedAccounts.initiate with both possible signatures
    if (typeof initiated === "function") {
      // Signature A: initiate({ userId, authConfigId, callbackUrl })
      try {
        const resA = await this.callSdkSafely(
          "connectedAccounts.initiate (obj)",
          () =>
            initiated.call(this.sdk.connectedAccounts, {
              userId,
              authConfigId,
              callbackUrl,
            })
        )
        return normalize(resA)
      } catch (_) {
        // Try with redirectUrl instead of callbackUrl
        try {
          const resARedirect = await this.callSdkSafely(
            "connectedAccounts.initiate (obj, redirectUrl)",
            () =>
              initiated.call(this.sdk.connectedAccounts, {
                userId,
                authConfigId,
                redirectUrl: callbackUrl,
              })
          )
          return normalize(resARedirect)
        } catch {
          // Signature B: initiate(userId, authConfigId, { callbackUrl })
          try {
            const resB = await this.callSdkSafely(
              "connectedAccounts.initiate (positional)",
              () =>
                initiated.call(
                  this.sdk.connectedAccounts,
                  userId,
                  authConfigId,
                  {
                    callbackUrl,
                  }
                )
            )
            return normalize(resB)
          } catch {
            // Signature B with redirectUrl
            const resBRedirect = await this.callSdkSafely(
              "connectedAccounts.initiate (positional, redirectUrl)",
              () =>
                initiated.call(
                  this.sdk.connectedAccounts,
                  userId,
                  authConfigId,
                  {
                    redirectUrl: callbackUrl,
                  }
                )
            )
            return normalize(resBRedirect)
          }
        }
      }
    }

    this.missingMethodError("connectedAccounts.link/initiate")
  }

  async waitForConnection({
    connectionRequestId,
    timeoutMs,
  }: ComposioWaitForConnectionArgs): Promise<ComposioConnectionStatus> {
    const method = (this.sdk as any)?.connectedAccounts?.waitForConnection
    if (typeof method !== "function") {
      this.missingMethodError("connectedAccounts.waitForConnection")
    }
    const status = await this.callSdkSafely(
      "connectedAccounts.waitForConnection",
      () =>
        // SDK signature: waitForConnection(connectionRequestId, timeoutMs?)
        method.call(this.sdk.connectedAccounts, connectionRequestId, timeoutMs)
    )
    return status as ComposioConnectionStatus
  }

  async getToolAuthStates({
    userId,
    toolSlugs,
  }: {
    userId: string
    toolSlugs: string[]
  }): Promise<ComposioToolAuthState[]> {
    // Not all SDK versions expose a dedicated auth states API.
    // If unavailable, return empty and let UI show "Needs auth" until connected.
    const method = (this.sdk as any)?.tools?.getAuthStates
    if (typeof method !== "function") {
      return []
    }
    const result = await this.callSdkSafely("tools.getAuthStates", () =>
      method.call(this.sdk.tools, userId, { toolSlugs })
    )
    return this.normaliseAuthStates(result)
  }

  async getToolDefinition({
    toolSlug,
  }: {
    toolSlug: string
  }): Promise<Record<string, unknown>> {
    const toolsApi: any = (this.sdk as any)?.tools
    if (!toolsApi) this.missingMethodError("tools")

    // Prefer retrieve/get-by-slug style if available (per client docs)
    const retrieve =
      toolsApi.retrieve ||
      toolsApi.getBySlug ||
      toolsApi.getToolByToolSlug ||
      toolsApi.getToolBySlug
    if (typeof retrieve === "function") {
      try {
        // Signature A: retrieve(slug)
        const resA = await this.callSdkSafely("tools.retrieve(slug)", () =>
          retrieve.call(toolsApi, toolSlug)
        )
        if (resA && typeof resA === "object")
          return resA as Record<string, unknown>
      } catch (_) {
        try {
          // Signature B: retrieve({ slug })
          const resB = await this.callSdkSafely(
            "tools.retrieve({ slug })",
            () => retrieve.call(toolsApi, { slug: toolSlug })
          )
          if (resB && typeof resB === "object")
            return resB as Record<string, unknown>
        } catch {
          // fall back to list APIs
        }
      }
    }

    const method = toolsApi.get
    if (typeof method !== "function") {
      this.missingMethodError("tools.get")
    }
    // Try documented TS signature first: tools.get(userId, { tools: [slug] })
    try {
      const resultDoc = await this.callSdkSafely(
        "tools.get (userId, tools)",
        () =>
          method.call(toolsApi, "schema-only", { tools: [toolSlug], limit: 1 })
      )
      const list = this.normaliseTools(resultDoc)
      return (list && (list[0] as any)) || {}
    } catch (_) {
      // Fallback: object call with single tool
      const resultObj = await this.callSdkSafely("tools.get (obj)", () =>
        method.call(toolsApi, { tool: toolSlug })
      )
      return (resultObj as Record<string, unknown>) ?? {}
    }
  }
}

let singleton: ComposioHttpClient | null = null

function resolveApiKey() {
  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey) {
    throw new ActionExecutionError("COMPOSIO_API_KEY is not configured", {
      status: 500,
      provider: "composio",
    })
  }
  return apiKey
}

export function isComposioEnabled() {
  return process.env.ACTIONS_COMPOSIO_ENABLED === "true"
}

export function getComposioClient() {
  if (!isComposioEnabled()) {
    throw new ActionExecutionError("Composio integration is disabled", {
      status: 503,
      provider: "composio",
    })
  }

  if (singleton) {
    return singleton
  }

  const apiKey = resolveApiKey()
  singleton = new ComposioHttpClient({
    apiKey,
    baseUrl: DEFAULT_BASE_URL,
    autoHandleFiles: false,
  })

  return singleton
}

export function resetComposioClient() {
  singleton = null
}
