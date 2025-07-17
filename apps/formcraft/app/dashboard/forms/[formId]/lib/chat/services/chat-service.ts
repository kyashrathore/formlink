import logger from "../../logger"

export class ChatService {
  constructor(private supabase: any) {}

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

    return data || []
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
