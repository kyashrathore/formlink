export interface ChatPanelProps {
  formId: string
  isCenteringBypassFixed?: boolean
  userId?: string
  layoutId?: string
  showSuggestions?: boolean
  initialMessage?: string
  initialModel?: string
}

export interface FormattedLogEvent {
  name: string
  timestamp: string
  data: Record<string, unknown>
  displayTime: string
  formattedContent: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
  parts?: unknown[]
  toolInvocations?: unknown[]
}

export interface AgentState {
  status?:
    | "INITIALIZING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "PARTIAL"
    | "COMPLETED_IMPLICITLY"
  originalInput?: string | Record<string, unknown>
}

export interface PanelState {
  isExpanded: boolean
  showChatInput: boolean
  displaySummaryMessage: string
}

export interface ChatDataItem {
  category?: string
  type?: string
  payload?: unknown
}
