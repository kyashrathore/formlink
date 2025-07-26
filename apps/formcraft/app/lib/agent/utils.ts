import fs from "fs/promises"
import path from "path"
import logger from "../logger"

export async function getAgentPromptText(
  promptFileName: string
): Promise<string> {
  const promptsDir = path.join(__dirname, "prompts")
  const promptPath = path.join(promptsDir, promptFileName)

  const backupPromptPath = path.resolve(
    process.cwd(),
    "apps/formcraft/app/lib/agent/prompts",
    promptFileName
  )

  try {
    try {
      const content = await fs.readFile(promptPath, "utf-8")
      return content
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        logger.warn(
          `Prompt file not found at ${promptPath}, trying ${backupPromptPath}`
        )
        const content = await fs.readFile(backupPromptPath, "utf-8")
        return content
      }
      throw e
    }
  } catch (error) {
    logger.error(
      `Error reading prompt file ${promptFileName} (checked ${promptPath} and ${backupPromptPath}):`,
      error
    )
    throw new Error(`Could not load prompt: ${promptFileName}`)
  }
}

interface StreamResult {
  object: Promise<unknown>
}

export async function handleStreamWithTimeout(
  streamResult: StreamResult,
  timeoutMs: number = 5000
): Promise<any> {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Stream timeout after ${timeoutMs}ms - possible authentication error (401) or network issue`
        )
      )
    }, timeoutMs)
  })

  try {
    const aiResponseData = await Promise.race([
      streamResult.object,
      timeoutPromise,
    ])

    return aiResponseData
  } catch (error) {
    const errorMessage = (error as Error)?.message || "Unknown stream error"
    const errorStatus =
      (error as Error & { status?: number; response?: { status?: number } })
        ?.status ||
      (error as Error & { status?: number; response?: { status?: number } })
        ?.response?.status

    if (errorMessage.includes("timeout")) {
      const timeoutError = new Error(
        "AI service request timed out - this may indicate an authentication issue (401) or network problem"
      )
      ;(timeoutError as Error & { status?: number }).status = 408
      throw timeoutError
    }

    if (
      errorStatus === 401 ||
      errorMessage.toLowerCase().includes("api key") ||
      errorMessage.toLowerCase().includes("unauthorized") ||
      errorMessage.toLowerCase().includes("authentication")
    ) {
      const authError = new Error(
        `AI service authentication failed: ${errorMessage}`
      )
      ;(authError as Error & { status?: number }).status = 401
      throw authError
    }

    throw error
  }
}
