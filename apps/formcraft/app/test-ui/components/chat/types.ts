export interface AgentInteractionPanelProps {
  formId: string
  isCenteringBypassFixed?: boolean
  userId?: string
  layoutId?: string
  showSuggestions?: boolean
  initialMessage?: string
}

export interface FormattedLogEvent {
  name: string
  timestamp: string
  data: any
  displayTime: string
  formattedContent: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
  parts?: any[]
  toolInvocations?: any[]
}

export interface AgentState {
  status?:
    | "INITIALIZING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "PARTIAL"
    | "COMPLETED_IMPLICITLY"
  originalInput?: string
}

export interface PanelState {
  isExpanded: boolean
  showChatInput: boolean
  displaySummaryMessage: string
}
