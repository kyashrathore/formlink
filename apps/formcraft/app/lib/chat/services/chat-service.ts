import logger from "@/app/lib/logger"
import { SupabaseClient } from "@formlink/db"

interface ChatMessage {
  role: string
  content?: string
  parts?: unknown
}

interface MessageRow {
  id: number
  role: string
  content: string
  created_at: string | null
  parts?: unknown
}

interface ChatHistoryItem {
  id: string
  role: string
  content: string
  createdAt: Date
  parts?: unknown
}

interface DataStream {
  write: (data: { type: string; [key: string]: unknown }) => void
}

interface UIActionData {
  action: string
  backend_timestamp: string
  [key: string]: unknown
}

export class ChatService {
  constructor(private supabase: SupabaseClient) {}

  async saveMessage(
    formId: string,
    userId: string,
    message: ChatMessage
  ): Promise<void> {
    const { error } = await this.supabase.from("messages").insert({
      form_id: formId,
      user_id: userId,
      role: message.role,
      content: message.content || "",
      parts: message.parts || null,
    })

    if (error) {
      logger.error("Error saving message to DB", {
        formId,
        userId,
        role: message.role,
        messageContent: message.content?.substring(0, 100) + "...",
        error,
      })

      if (message.role === "user") {
        throw new Error(`Failed to save user message: ${error.message}`)
      }
    }
  }

  async saveUserMessage(
    formId: string,
    userId: string,
    content: string
  ): Promise<void> {
    await this.saveMessage(formId, userId, {
      role: "user",
      content: content,
    })
  }

  async saveAssistantMessage(
    formId: string,
    userId: string,
    content: string
  ): Promise<void> {
    await this.saveMessage(formId, userId, {
      role: "assistant",
      content: content,
    })
  }

  async getChatHistory(formId: string): Promise<ChatHistoryItem[]> {
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

    return (data || []).map((row: MessageRow) => ({
      id: row.id.toString(),
      role: row.role,
      content: row.content,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      ...(row.parts ? { parts: row.parts } : {}),
    }))
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
    // AI SDK v5: Use data- prefix with proper data structure
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
    const eventData: UIActionData = {
      action,
      ...data,
      backend_timestamp: new Date().toISOString(),
    }
    dataStream.write({
      type: "data",

      value: [
        {
          eventName: "ui_action",
          eventData,
        },
      ],
    })
  }
}
