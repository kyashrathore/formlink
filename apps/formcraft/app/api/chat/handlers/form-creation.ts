import { getModel } from "@/app/lib/ai/provider"
import {
  buildContextualSystemPrompt,
  SYSTEM_PROMPT,
} from "@/app/lib/chat/prompts"
import { ChatService } from "@/app/lib/chat/services/chat-service"
import { FormService } from "@/app/lib/chat/services/form-service"
import { createChatTools } from "@/app/lib/chat/tools"
import logger from "@/app/lib/logger"
import { SupabaseClient } from "@formlink/db"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  UIMessage,
} from "ai"
import { customAlphabet } from "nanoid"

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  10
)

interface ChatRequestOptions {
  temperature?: number
  maxOutputTokens?: number
}

export async function handleChatRequest(
  messages: UIMessage[],
  formId: string | undefined,
  userId: string,
  supabase: SupabaseClient,
  options?: ChatRequestOptions
) {
  const currentFormId = formId || `form_${nanoid()}`
  const isNewChat = !formId
  const isFirstMessage = messages.length === 1

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

  const chatService = new ChatService(supabase)
  // Convert UIMessages to compatible format for saving
  const lastMessage = messages[messages.length - 1]
  if (lastMessage && lastMessage.role === "user") {
    // Extract text from v5 UIMessage parts
    const userText =
      (lastMessage.parts?.find((p: any) => p.type === "text") as any)?.text ||
      ""
    const messageToSave = {
      ...lastMessage,
      content: userText,
    }
    await chatService.saveMessage(currentFormId, userId, messageToSave)
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        if (isNewChat) {
        }
        chatService.writeStreamEvent(writer as any, "chat_initialized")

        const toolContext = {
          dataStream: writer as any,
          formId: currentFormId,
          supabase,
          userId,
          options,
          isFirstMessage,
        }

        // Build tools. On first message/new chat, expose only createForm to prevent premature getFormContext.
        const baseTools = createChatTools(toolContext) as any
        const tools = isFirstMessage
          ? { createForm: baseTools.createForm }
          : baseTools

        if (isFirstMessage) {
          logger.info(
            "[handleChatRequest] First message detected. Restricting tools to { createForm } for deterministic creation flow."
          )
        }

        // Use provider utility to get model - using OpenRouter to avoid Vercel restrictions
        const MODEL = getModel("google/gemini-2.5-pro", "openrouter")

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
          messages: convertToModelMessages(messages),
          tools,
          system: contextualSystemPrompt,
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxOutputTokens || 4000,
          onFinish: async ({ text, toolCalls, finishReason, usage }) => {
            logger.info("Chat completion finished", {
              userId,
              formId: currentFormId,
              text,
              usage,
              finishReason,
            })

            try {
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
            }
            chatService.writeStreamEvent(writer as any, "chat_completed")
          },
          onError: async (error) => {
            logger.error("Chat completion error", {
              userId,
              formId: currentFormId,
              error,
            })

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
          toolChoice: "auto",
          stopWhen: stepCountIs(5),
        })

        // AI SDK v5: Merge the result into the UI message stream
        writer.merge(result.toUIMessageStream())
      } catch (executeError) {
        logger.error("Error in chat stream execution", {
          userId,
          formId: currentFormId,
          error: executeError,
        })

        // Let AI SDK handle error formatting automatically
      }
    },
    onError: (error) => {
      logger.error("Error in chat stream:", { error })
      return error instanceof Error ? error.message : String(error)
    },
  })

  return createUIMessageStreamResponse({ stream })
}
