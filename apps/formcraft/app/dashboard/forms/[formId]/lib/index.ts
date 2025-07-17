import { Form } from "@formlink/schema"
import type {
  CoreAssistantMessage,
  CoreToolMessage,
  Message,
  UIMessage,
} from "ai"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const parseFormSchema = (content: string | object): Form => {
  if (typeof content === "object" && content !== null) {
    const schema = content as Record<string, any>

    if (schema.questions && typeof schema.questions === "string") {
      try {
        schema.questions = parseFormSchema(
          JSON.parse(schema.questions)
        ).questions
      } catch (error) {
        console.error("Failed to parse stringified questions:", error)
      }
    }

    if (schema.questions && Array.isArray(schema.questions)) {
      schema.questions = schema.questions.map((question) => {
        if (question.options && typeof question.options === "string") {
          try {
            question.options = JSON.parse(question.options)
          } catch (error) {
            console.error("Failed to parse stringified options:", error)
          }
        }
        return question
      })
    }

    return schema as Form
  }

  try {
    const parsed = JSON.parse(content as string)

    return parseFormSchema(parsed)
  } catch (error) {
    console.error("Error parsing FormSchema:", error)

    return {} as Form
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ApplicationError extends Error {
  info: string
  status: number
}

export const fetcher = async (url: string) => {
  const res = await fetch(url)

  if (!res.ok) {
    const error = new Error(
      "An error occurred while fetching the data."
    ) as ApplicationError

    error.info = await res.json()
    error.status = res.status

    throw error
  }

  return res.json()
}

export function getLocalStorage(key: string) {
  if (typeof window !== "undefined") {
    return JSON.parse(localStorage.getItem(key) || "[]")
  }
  return []
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function addToolMessageToChat({
  toolMessage,
  messages,
}: {
  toolMessage: CoreToolMessage
  messages: Array<Message>
}): Array<Message> {
  return messages.map((message) => {
    if (message.toolInvocations) {
      return {
        ...message,
        toolInvocations: message.toolInvocations.map((toolInvocation) => {
          const toolResult = toolMessage.content.find(
            (tool) => tool.toolCallId === toolInvocation.toolCallId
          )

          if (toolResult) {
            return {
              ...toolInvocation,
              state: "result",
              result: toolResult.result,
            }
          }

          return toolInvocation
        }),
      }
    }

    return message
  })
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage
type ResponseMessage = ResponseMessageWithoutId & { id: string }

export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === "user")
  return userMessages.at(-1)
}

export function getTrailingMessageId({
  messages,
}: {
  messages: Array<ResponseMessage>
}): string | null {
  const trailingMessage = messages.at(-1)

  if (!trailingMessage) return null

  return trailingMessage.id
}
