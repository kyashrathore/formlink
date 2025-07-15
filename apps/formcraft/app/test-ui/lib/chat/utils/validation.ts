import { ChatRequest } from "../../types/chat"

export function validateChatRequest(body: any): Omit<ChatRequest, "userId"> {
  const { messages, formId, options } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error("Missing or invalid 'messages' field")
  }

  return { messages, formId, options }
}
