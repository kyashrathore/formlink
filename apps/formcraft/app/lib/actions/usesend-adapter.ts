import logger from "@/app/lib/logger"
import { UseSend } from "usesend-js"
import { ActionExecutionError } from "./errors"

export interface SendEmailParams {
  to: string | string[]
  from: string
  subject?: string
  templateId?: string
  variables?: Record<string, string>
  replyTo?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  text?: string | null
  html?: string | null
  attachments?: { filename: string; content: string }[]
  scheduledAt?: string
  inReplyToId?: string | null
}

let client: UseSend | null = null

function ensureApiKey() {
  const apiKey = process.env.USE_SEND_API_KEY
  if (!apiKey) {
    throw new ActionExecutionError("USE_SEND_API_KEY is not configured", {
      status: 500,
      provider: "usesend",
    })
  }
  return apiKey
}

function getClient() {
  if (client) return client
  const apiKey = ensureApiKey()
  client = new UseSend(apiKey, process.env.USE_SEND_BASE_URL)
  return client
}

export async function sendEmail(params: SendEmailParams) {
  const usesend = getClient()
  const defaultFrom =
    process.env.USE_SEND_DEFAULT_FROM || "notifications@formlink.app"
  const payload: SendEmailParams = {
    ...(params || ({} as any)),
    from: ((params as any)?.from as string) || defaultFrom,
  }
  const { data, error } = await usesend.emails.send(payload)
  if (error) {
    logger.error?.("[usesend] email send failed", { error, params: payload })
    throw new ActionExecutionError(error.message || "useSend send failed", {
      status: 502,
      provider: "usesend",
      code: error.code,
      cause: error,
    })
  }
  return data
}

export function resetUseSendClient() {
  client = null
}
