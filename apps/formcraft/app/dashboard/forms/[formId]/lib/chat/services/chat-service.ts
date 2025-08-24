import { SupabaseClient } from "@formlink/db"
import logger from "../../logger"

interface DataStream {
  write: (data: { type: string; [key: string]: unknown }) => void
}

interface MessageRow {
  id: number
  role: string
  content: string
  created_at: string | null
  [key: string]: unknown
}

export class ChatService {
  constructor(private supabase: SupabaseClient) {}

  async saveUserMessage(
    formId: string,
    userId: string,
    content: string
  ): Promise<void> {
    const { error } = await this.supabase.from("messages").insert({
      form_id: formId,
      user_id: userId,
      role: "user",
      content: content,
    })

    if (error) {
      logger.error("Error saving user message to DB", { formId, userId, error })
    }
  }

  async saveAssistantMessage(
    formId: string,
    userId: string,
    content: string
  ): Promise<void> {
    const { error } = await this.supabase.from("messages").insert({
      form_id: formId,
      user_id: userId,
      role: "assistant",
      content: content,
    })

    if (error) {
      logger.error("Error saving assistant message to DB", {
        formId,
        userId,
        error,
      })
    }
  }

  async getChatHistory(formId: string): Promise<MessageRow[]> {
    const { data, error } = await this.supabase
      .from("messages")
      .select("*")
      .eq("form_id", formId)
      .order("created_at", { ascending: true })

    if (error) {
      logger.error("Error fetching chat history from DB", {
        formId,
        error: error.message,
      })
      throw new Error(`Failed to fetch chat history: ${error.message}`)
    }

    return data || []
  }

  writeStreamEvent(
    dataStream: DataStream,
    eventType: string,
    payload?: unknown
  ): void {
    // AI SDK v5: Use data- prefix for custom data streaming
    if (payload) {
      dataStream.write({ type: `data-${eventType}`, payload })
    } else {
      dataStream.write({ type: `data-${eventType}` })
    }
  }

  writeCustomAgentEvent(dataStream: DataStream, agentEvent: unknown): void {
    // AI SDK v5: Use data- prefix for custom data streaming
    dataStream.write({
      type: "data-agent_event",
      data: agentEvent,
    })
  }

  writeUIAction(
    dataStream: DataStream,
    action: string,
    data: Record<string, unknown>
  ): void {
    // AI SDK v5: Use data- prefix for custom data streaming
    dataStream.write({
      type: "data-ui_action",
      eventName: "ui_action",
      eventData: {
        action,
        ...data,
        backend_timestamp: new Date().toISOString(),
      },
    })
  }
}
