export type ActionProvider = "usesend" | "composio"

export interface ComposioToolSummary {
  slug: string
  name: string
  description?: string
  toolkit?: string
  scopes?: string[]
  authConfigId?: string
  isEnabled?: boolean
}

export interface ComposioSearchArgs {
  userId: string
  query?: string
  toolkits?: string[]
  limit?: number
}

export interface ComposioGetArgs {
  userId: string
  toolkits?: string[]
  scopes?: string[]
  limit?: number
}

export interface ComposioExecuteArgs {
  toolSlug: string
  userId: string
  args: Record<string, unknown>
}

export interface ComposioEnsureAuthArgs {
  userId: string
  authConfigId: string
  callbackUrl?: string
}

export interface ComposioAuthLink {
  redirectUrl: string
  connectionRequestId: string
  expiresAt?: string
}

export type ComposioAuthStatus =
  | "not_connected"
  | "pending"
  | "connected"
  | "unknown"

export interface ComposioExecutionResult {
  providerReference?: string
  data?: unknown
}

export interface ComposioToolAuthState {
  toolSlug: string
  status: ComposioAuthStatus
  connectedAccountId?: string
  lastCheckedAt?: string
}
export interface ComposioWaitForConnectionArgs {
  userId: string
  connectionRequestId: string
  timeoutMs?: number
}

export interface ComposioConnectionStatus {
  status: ComposioAuthStatus
  connectedAccountId?: string
  completedAt?: string
}
