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
  singlePass?: boolean
}
