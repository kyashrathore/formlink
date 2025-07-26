import { SupabaseClient } from "@supabase/supabase-js"
import logger from "../../logger"

interface DataStream {
  writeData: (data: unknown) => void
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
    if (payload) {
      dataStream.writeData({ type: eventType, payload })
    } else {
      dataStream.writeData(eventType)
    }
  }

  writeCustomAgentEvent(dataStream: DataStream, agentEvent: unknown): void {
    dataStream.writeData({
      type: "custom_agent_event",
      payload: agentEvent,
    })
  }

  writeUIAction(
    dataStream: DataStream,
    action: string,
    data: Record<string, unknown>
  ): void {
    dataStream.writeData({
      eventName: "ui_action",
      eventData: {
        action,
        ...data,
        backend_timestamp: new Date().toISOString(),
      },
    })
  }
}
