import logger from "../../logger"

export class ChatService {
  constructor(private supabase: any) {}

  async saveMessage(
    formId: string,
    userId: string,
    message: any
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
      // Only throw for user messages to ensure they're saved
      // For assistant messages, we'll log but continue
      if (message.role === "user") {
        throw new Error(`Failed to save user message: ${error.message}`)
      }
    }
  }

  // Keep backward compatibility methods
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

  async getChatHistory(formId: string): Promise<any[]> {
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

    // Reconstruct proper AI SDK message format
    return (data || []).map((row: any) => ({
      id: row.id.toString(), // Convert bigint to string for AI SDK compatibility
      role: row.role,
      content: row.content,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      ...(row.parts && { parts: row.parts }),
    }))
  }

  writeStreamEvent(dataStream: any, eventType: string, payload?: any): void {
    if (payload) {
      dataStream.writeData({ type: eventType, payload })
    } else {
      dataStream.writeData(eventType)
    }
  }

  writeCustomAgentEvent(dataStream: any, agentEvent: any): void {
    dataStream.writeData({
      type: "custom_agent_event",
      payload: agentEvent,
    })
  }

  writeUIAction(dataStream: any, action: string, data: any): void {
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
