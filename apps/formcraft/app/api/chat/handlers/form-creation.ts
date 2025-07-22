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

  // Save user message with complete structure
  const chatService = new ChatService(supabase)
  const lastMessage = messages[messages.length - 1]
  if (lastMessage && lastMessage.role === "user") {
    await chatService.saveMessage(currentFormId, userId, lastMessage)
  }

  return createDataStreamResponse({
    execute: async (dataStream) => {
      try {
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
          onFinish: async ({
            text,
            toolCalls,
            toolResults,
            finishReason,
            usage,
          }) => {
            logger.info("Chat completion finished", {
              userId,
              formId: currentFormId,
              text,
              usage,
              finishReason,
            })

            try {
              // Create assistant message from the completion event
              const assistantMessage = {
                role: "assistant",
                content: text,
                parts: toolCalls || null,
              }

              logger.info("Attempting to save assistant message", {
                formId: currentFormId,
                userId,
                messageRole: assistantMessage.role,
                messageContent:
                  assistantMessage.content?.substring(0, 100) + "...",
                hasToolCalls: !!toolCalls,
              })

              await chatService.saveMessage(
                currentFormId,
                userId,
                assistantMessage
              )

              logger.info("Assistant message saved successfully", {
                formId: currentFormId,
                userId,
              })
            } catch (error) {
              logger.error("Error saving assistant message", {
                formId: currentFormId,
                userId,
                error,
              })
              // Don't throw - let the response complete even if message saving fails
            }
            chatService.writeStreamEvent(dataStream, "chat_completed")
          },
          onError: async (error) => {
            logger.error("Chat completion error", {
              userId,
              formId: currentFormId,
              error,
            })

            // Save error message to chat history
            try {
              await chatService.saveMessage(currentFormId, userId, {
                role: "assistant",
                content:
                  "I encountered an error while processing your request. Please try again.",
                parts: [
                  {
                    type: "tool-invocation",
                    toolInvocation: {
                      state: "error",
                      toolName: "system",
                      error:
                        error instanceof Error ? error.message : String(error),
                    },
                  },
                ],
              })
            } catch (saveError) {
              logger.error("Failed to save error message", { saveError })
            }
          },
        })

        result.mergeIntoDataStream(dataStream)
      } catch (executeError) {
        logger.error("Error in chat stream execution", {
          userId,
          formId: currentFormId,
          error: executeError,
        })

        // Write error to stream in AI SDK compatible format
        dataStream.writeData({
          type: "error",
          message:
            executeError instanceof Error
              ? executeError.message
              : "Stream execution error",
        })
      }
    },
    onError: (error) => {
      logger.error("Error in chat stream:", { error })
      return error instanceof Error ? error.message : String(error)
    },
  })
}
