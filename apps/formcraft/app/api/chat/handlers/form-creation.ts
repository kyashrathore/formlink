import { getModel } from "@/app/lib/ai/provider"
import { ChatService } from "@/app/lib/chat/services/chat-service"
import { FormService } from "@/app/lib/chat/services/form-service"
import { createChatTools } from "@/app/lib/chat/tools"
import logger from "@/app/lib/logger"
import { SupabaseClient } from "@formlink/db"
import { loadPrompt } from "@formlink/prompts"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
} from "ai"
import { customAlphabet } from "nanoid"
import { streamText } from "../../../lib/ai/tracing"

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-",
  10
)

interface ChatRequestOptions {
  model?: string
  temperature?: number
  maxOutputTokens?: number
}

async function ensureFormExists(
  supabase: SupabaseClient,
  formId: string,
  userId: string
) {
  const formService = new FormService(supabase)
  try {
    await formService.ensureFormExists(formId, userId)
    logger.info(`[handleChatRequest] Form ${formId} ensured for user ${userId}`)
  } catch (error) {
    logger.error(`[handleChatRequest] Failed to ensure form exists`, {
      formId,
      userId,
      error,
    })
    throw error
  }
}

export async function handleChatRequest(
  messages: UIMessage[],
  formId: string | undefined,
  userId: string,
  supabase: SupabaseClient,
  options?: ChatRequestOptions
) {
  const currentFormId = formId || `form_${nanoid()}`

  await ensureFormExists(supabase, currentFormId, userId)

  const chatDB = new ChatService(supabase)

  // Persist the last user message as-is
  const lastUserMessage = messages[messages.length - 1]
  if (lastUserMessage?.role === "user") {
    await chatDB.saveMessage(currentFormId, userId, lastUserMessage)
  }

  let writerRef: any = null
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        writerRef = writer as any
        chatDB.writeStreamEvent(writer as any, "chat_initialized")

        const toolContext = {
          dataStream: writer as any, // Cast to 'any' to avoid type mismatch
          formId: currentFormId,
          supabase,
          userId,
          options,
          isFirstMessage: messages.length <= 1,
        }

        const tools = createChatTools(toolContext)
        const intent = (options as any)?.intent || "general"
        const riFlag = Boolean((options as any)?.responseIntelligence)
        const system = await loadPrompt("chat/form-creation-system.md", {
          session_form_id: currentFormId,
          session_intent: intent,
          ri_requested: riFlag,
          // Include guardrails only for user-facing chat endpoint
          include_guards: true,
        })
        const MODEL = getModel(options?.model)
        const result = await streamText({
          model: MODEL,
          messages: convertToModelMessages(messages),
          tools,
          system,
          maxOutputTokens: options?.maxOutputTokens ?? 2000,
          toolChoice: "auto",
          stopWhen({ steps }) {
            // Stop if `createForm` has been successfully called and produced a result.
            const hasCreateFormResult = steps.some((s) =>
              s.toolResults?.some(
                (tr) =>
                  tr.toolName === "createForm" &&
                  "result" in tr &&
                  tr.result != null
              )
            )
            return steps.length > 10 || hasCreateFormResult
          },
        })

        writer.merge(result.toUIMessageStream())
      } catch (executeError) {
        logger.error("Error in chat stream execution", {
          userId,
          formId: currentFormId,
          error: executeError,
        })
      }
    },
    onFinish: async ({ messages: finalMessages }) => {
      // The last message in the stream is the complete assistant message
      const assistantMessage = finalMessages[finalMessages.length - 1]

      if (assistantMessage && assistantMessage.role === "assistant") {
        try {
          await chatDB.saveMessage(currentFormId, userId, assistantMessage)
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
      }
      if (writerRef && typeof writerRef.write === "function") {
        chatDB.writeStreamEvent(writerRef, "chat_completed")
      }
    },
    onError: (error) => {
      logger.error("Error in chat stream:", { error })
      return error instanceof Error ? error.message : String(error)
    },
  })

  return createUIMessageStreamResponse({ stream })
}
