import { ChatRequest } from "../../types/chat"

export function validateChatRequest(
  body: unknown
): Omit<ChatRequest, "userId"> {
  const { messages, formId, options } = body as Record<string, unknown>

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error("Missing or invalid 'messages' field")
  }

  return {
    messages,
    formId: formId as string | undefined,
    options: options as
      | { model?: string; temperature?: number; maxTokens?: number }
      | undefined,
  }
}
