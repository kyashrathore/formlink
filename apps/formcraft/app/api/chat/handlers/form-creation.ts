import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createDataStreamResponse, streamText } from "ai"
import { customAlphabet } from "nanoid"
import { getenv } from "../../../../lib/env"
import {
  buildContextualSystemPrompt,
  SYSTEM_PROMPT,
} from "../../../lib/chat/prompts"
import { ChatService } from "../../../lib/chat/services/chat-service"
import { FormService } from "../../../lib/chat/services/form-service"
import { createChatTools } from "../../../lib/chat/tools"
import logger from "../../../lib/logger"

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  10
)

export async function handleChatRequest(
  messages: any[],
  formId: string | undefined,
  userId: string,
  supabase: any,
  options?: any
) {
  const currentFormId = formId || `form_${nanoid()}`
  const isNewChat = !formId
  const isFirstMessage = messages.length === 1

  // Ensure form exists
  const formService = new FormService(supabase)
  try {
    await formService.ensureFormExists(currentFormId, userId)
    logger.info(
      `[handleChatRequest] Form ${currentFormId} ensured for user ${userId}`
    )
  } catch (error) {
    logger.error(`[handleChatRequest] Failed to ensure form exists`, {
      formId: currentFormId,
      userId,
      error,
    })
    throw error
  }

  // Save user message
  const chatService = new ChatService(supabase)
  const lastMessage = messages[messages.length - 1]
  if (lastMessage && lastMessage.role === "user") {
    await chatService.saveUserMessage(
      currentFormId,
      userId,
      lastMessage.content
    )
  }

  return createDataStreamResponse({
    execute: async (dataStream) => {
      if (isNewChat) {
        // dataStream.writeData({ type: 'form_session_initialized', payload: { formId: currentFormId } });
      }
      chatService.writeStreamEvent(dataStream, "chat_initialized")

      // Create tool context
      const toolContext = {
        dataStream,
        formId: currentFormId,
        supabase,
        userId,
        options,
        isFirstMessage,
      }

      const tools = createChatTools(toolContext)

      // Set up AI provider
      const apiKey = getenv("OPENROUTER_API_KEY") || ""
      const openRouterProvider = createOpenRouter({ apiKey })
      const MODEL = openRouterProvider("openai/gpt-4o")

      // Build contextual system prompt
      const contextualSystemPrompt = buildContextualSystemPrompt(
        SYSTEM_PROMPT,
        {
          isFirstMessage,
          isNewChat,
          currentFormId,
        }
      )

      const result = await streamText({
        model: MODEL,
        messages,
        tools,
        system: contextualSystemPrompt,
        temperature: options?.temperature || 0.7,
        maxTokens: options?.maxTokens || 4000,
        maxSteps: 5,
        // Enable streaming of tool calls and steps for AI SDK 4.3.16
        experimental_toolCallStreaming: true,
        onFinish: async (event) => {
          logger.info("Chat completion finished", {
            userId,
            formId: currentFormId,
            text: event.text,
            usage: event.usage,
            finishReason: event.finishReason,
          })

          if (event.text) {
            await chatService.saveAssistantMessage(
              currentFormId,
              userId,
              event.text
            )
          }
          chatService.writeStreamEvent(dataStream, "chat_completed")
        },
        onError: async (error) => {
          logger.error("Chat completion error", {
            userId,
            formId: currentFormId,
            error,
          })
        },
      })

      result.mergeIntoDataStream(dataStream)
    },
    onError: (error) => {
      logger.error("Error in chat stream:", { error })
      return error instanceof Error ? error.message : String(error)
    },
  })
}
