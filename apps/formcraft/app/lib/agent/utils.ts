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
    } catch (e: any) {
      if (e.code === "ENOENT") {
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

// Helper function to handle stream with timeout and error detection
export async function handleStreamWithTimeout(
  streamResult: any,
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
    // Race between the stream object promise and timeout
    const aiResponseData = await Promise.race([
      streamResult.object,
      timeoutPromise,
    ])

    return aiResponseData
  } catch (error: any) {
    // Enhanced error detection for common issues
    const errorMessage = error?.message || "Unknown stream error"
    const errorStatus = error?.status || error?.response?.status

    // Check if it's a timeout error
    if (errorMessage.includes("timeout")) {
      const timeoutError = new Error(
        "AI service request timed out - this may indicate an authentication issue (401) or network problem"
      )
      ;(timeoutError as any).status = 408 // Request Timeout
      throw timeoutError
    }

    // Check for authentication errors
    if (
      errorStatus === 401 ||
      errorMessage.toLowerCase().includes("api key") ||
      errorMessage.toLowerCase().includes("unauthorized") ||
      errorMessage.toLowerCase().includes("authentication")
    ) {
      const authError = new Error(
        `AI service authentication failed: ${errorMessage}`
      )
      ;(authError as any).status = 401
      throw authError
    }

    // Re-throw other errors as-is
    throw error
  }
}
