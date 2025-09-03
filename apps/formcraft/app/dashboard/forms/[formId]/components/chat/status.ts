export type ChatUIStatus =
  | "idle"
  | "preparing"
  | "streaming"
  | "tool-running"
  | "ready"
  | "error"

export function computeChatStatus(params: {
  chatStatus: "idle" | "submitted" | "streaming" | "error" | string
  lastAssistantParts?: any[]
  agentFailed?: boolean
}): ChatUIStatus {
  if (params.agentFailed || params.chatStatus === "error") return "error"
  if (params.chatStatus === "streaming") return "streaming"
  if (params.chatStatus === "submitted") return "preparing"
  const parts = params.lastAssistantParts || []
  const activeTool = parts.some((p: any) => {
    if (!p || typeof p !== "object") return false
    const t = p.type
    if (t === "tool-invocation") {
      const s = p.toolInvocation?.state
      return s === "input-streaming" || s === "input-available"
    }
    return false
  })
  if (activeTool) return "tool-running"
  return "ready"
}
