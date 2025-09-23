import type { ActionProvider } from "./types"

export interface ActionToolSummary {
  slug: string
  label: string
  description?: string
  provider: ActionProvider
  toolkit?: string
  requiredScopes?: string[]
  authStatus: string
  connectedAccountId?: string | null
  configured: boolean
  uiStatus?: "needs_auth" | "needs_setup" | "ready"
}
