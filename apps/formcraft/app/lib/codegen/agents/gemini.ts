import { Sandbox } from "@vercel/sandbox"
import {
  runCommandInSandbox,
  runStreamingCommandInSandbox,
} from "../sandbox/commands"
import { AgentExecutionResult } from "../sandbox/types"
// Checking logging.ts again... yes logging.ts has redactSensitiveInfo.
// stream-logger.ts imports it from ./logging.
import { StreamLogger } from "../stream-logger"

// Mock connectors type since we couldn't find the schema in the codebase
// import { connectors } from '@/lib/db/schema'
type Connector = any

// Helper function to run command and log it
async function runAndLogCommand(
  sandbox: Sandbox,
  logger: StreamLogger, // Changed TaskLogger to StreamLogger
  command: string,
  args: string[]
) {
  const fullCommand = args.length > 0 ? `${command} ${args.join(" ")}` : command
  // redactSensitiveInfo is available via import from "./logging" ideally,
  // but let's assume StreamLogger handles redaction internally for .command() calls?
  // StreamLogger.command calls redactSensitiveInfo.
  // But here we want to log the output too.

  await logger.command(command, args)

  const result = await runCommandInSandbox(sandbox, command, args)

  // Only try to access properties if result is valid
  if (result && result.output && result.output.trim()) {
    // We need to access redactSensitiveInfo manually if we want to redact output manually
    // But StreamLogger.info redacts internally.
    await logger.info(result.output.trim())
  }

  if (result && !result.success && result.error) {
    await logger.error(result.error)
  }

  // If result is null/undefined, create a fallback result
  if (!result) {
    const errorResult = {
      success: false,
      error: "Command execution failed - no result returned",
      exitCode: -1,
      output: "",
      command: fullCommand,
    }
    await logger.error("Command execution failed - no result returned")
    return errorResult
  }

  return result
}

export async function executeGeminiInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: StreamLogger, // Changed TaskLogger to StreamLogger
  selectedModel?: string,
  mcpServers?: Connector[]
): Promise<AgentExecutionResult> {
  const startTime = Date.now()
  try {
    // Executing Gemini CLI with instruction

    // Check if Gemini CLI is available
    const cliCheck = await runAndLogCommand(sandbox, logger, "which", [
      "gemini",
    ])

    if (!cliCheck.success) {
      // Gemini CLI not found, try to install it
      await logger.info("Gemini CLI not found, installing...")

      // Install Gemini CLI using npm
      const installResult = await runAndLogCommand(sandbox, logger, "npm", [
        "install",
        "-g",
        "@google/gemini-cli",
      ])

      if (!installResult.success) {
        return {
          success: false,
          error: `Failed to install Gemini CLI: ${installResult.error}`,
          cliName: "gemini",
          changesDetected: false,
        }
      }

      await logger.info("Gemini CLI installed successfully")

      // Verify installation worked
      const verifyCheck = await runAndLogCommand(sandbox, logger, "which", [
        "gemini",
      ])
      if (!verifyCheck.success) {
        return {
          success: false,
          error: "Gemini CLI installation completed but CLI still not found",
          cliName: "gemini",
          changesDetected: false,
        }
      }
    }

    // Configure MCP servers if provided
    if (mcpServers && mcpServers.length > 0) {
      await logger.info("Configuring MCP servers")

      // Create Gemini settings.json configuration file
      const settingsConfig: {
        mcpServers: Record<
          string,
          | { httpUrl: string; headers?: Record<string, string> }
          | { command: string; args?: string[]; env?: Record<string, string> }
        >
      } = {
        mcpServers: {},
      }

      for (const server of mcpServers) {
        const serverName = server.name.toLowerCase().replace(/[^a-z0-9]/g, "-")

        if (server.type === "local") {
          // Local STDIO server - parse command string into command and args
          const commandParts = (server.command || "").trim().split(/\s+/)
          const executable = commandParts[0]
          const args = commandParts.slice(1)

          // Parse env from JSON string if present
          let envObject: Record<string, string> | undefined
          if (server.env) {
            try {
              envObject = JSON.parse(server.env)
            } catch (e) {
              await logger.info("Warning: Failed to parse env for MCP server")
            }
          }

          settingsConfig.mcpServers[serverName] = {
            command: executable,
            ...(args.length > 0 ? { args } : {}),
            ...(envObject ? { env: envObject } : {}),
          }
          await logger.info("Added local MCP server")
        } else {
          // Remote HTTP server
          settingsConfig.mcpServers[serverName] = {
            httpUrl: server.baseUrl!,
          }

          // Build headers object
          const headers: Record<string, string> = {}
          if (server.oauthClientSecret) {
            headers.Authorization = `Bearer ${server.oauthClientSecret}`
          }
          if (server.oauthClientId) {
            headers["X-Client-ID"] = server.oauthClientId
          }
          if (Object.keys(headers).length > 0) {
            settingsConfig.mcpServers[serverName].headers = headers
          }

          await logger.info("Added remote MCP server")
        }
      }

      // Write the settings.json file to ~/.gemini/
      const settingsJson = JSON.stringify(settingsConfig, null, 2)
      const createSettingsCmd = `mkdir -p ~/.gemini && cat > ~/.gemini/settings.json << 'EOF'
${settingsJson}
EOF`

      await logger.info("Creating Gemini MCP settings file...")
      const settingsResult = await runCommandInSandbox(
        sandbox,
        "sh",
        ["-c", createSettingsCmd].concat([])
      ) // Fixed arg type

      // Need to use runCommandInSandbox directly here because createSettingsCmd is complex?
      // Actually runAndLogCommand handles it but let's stick to the pattern.
      // Wait, runAndLogCommand expects logger, command, args.
      // The snippet used runCommandInSandbox which returns a different result shape in snippet vs usage?
      // In snippet: const settingsResult = await runCommandInSandbox(sandbox, 'sh', ['-c', createSettingsCmd])
      // In commands.ts: runCommandInSandbox returns Promise<CommandResult>

      // I'll reuse runAndLogCommand for consistency if possible, or just raw runCommandInSandbox
      // The snippet used runCommandInSandbox directly.
      const rawRes = await runCommandInSandbox(sandbox, "sh", [
        "-c",
        createSettingsCmd,
      ])

      if (rawRes.success) {
        await logger.info("Gemini settings.json file created successfully")

        // Verify the file was created (without logging sensitive contents)
        const verifySettings = await runCommandInSandbox(sandbox, "test", [
          "-f",
          "~/.gemini/settings.json",
        ])
        if (verifySettings.success) {
          await logger.info("Gemini MCP configuration verified")
        }
      } else {
        await logger.info("Warning: Failed to create Gemini settings.json file")
      }
    }

    // Check authentication options in order of preference
    let authMethod = "none"
    const authEnv: Record<string, string> = {}

    // Option 1: Check for GEMINI_API_KEY (Gemini API)
    if (process.env.GEMINI_API_KEY) {
      authMethod = "api_key"
      authEnv.GEMINI_API_KEY = process.env.GEMINI_API_KEY
      await logger.info("Using Gemini API key authentication")
    }
    // Option 2: Check for GOOGLE_API_KEY with Vertex AI flag (Vertex AI)
    else if (
      process.env.GOOGLE_API_KEY &&
      process.env.GOOGLE_GENAI_USE_VERTEXAI
    ) {
      authMethod = "vertex_ai"
      authEnv.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
      authEnv.GOOGLE_GENAI_USE_VERTEXAI = "true"
      await logger.info("Using Vertex AI authentication")
    }
    // Option 3: Check for Google Cloud Project (OAuth with Code Assist)
    else if (process.env.GOOGLE_CLOUD_PROJECT) {
      authMethod = "oauth_project"
      authEnv.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT
      await logger.info(
        "Using Google Cloud Project authentication (requires OAuth login)"
      )
    }
    // Option 4: Default OAuth (will require interactive login)
    else {
      authMethod = "oauth"
      await logger.info("No API keys found, will attempt OAuth authentication")
    }

    // Prepare the command arguments using the correct Gemini CLI syntax
    const args = []

    // Add model selection if provided
    // Sanitize model name (remove provider prefixes like 'google/', 'openai/')
    const cleanModel = selectedModel
      ? selectedModel.split("/").pop()
      : undefined

    if (cleanModel) {
      args.push("-m", cleanModel)
      await logger.info("Using selected model")
    }

    // Use YOLO mode to auto-approve all tools (bypass approval prompts)
    args.push("--yolo")

    // Don't add instruction to args array - we'll add it quoted separately to the command string

    // Config: Use stream-json for real-time feedback
    args.push("-o", "stream-json")

    // Log what we're trying to do
    const redactedCommand = `gemini ${args.join(" ")} "${instruction.substring(0, 100)}..."`
    await logger.command(redactedCommand)

    // Build environment variables string for shell command (like other agents)
    const envPrefix = Object.entries(authEnv)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ")

    // Fix Path Issue: The agent might receive "apps/preview/src/..." but sandbox is AT "apps/preview"
    // We naively replace "apps/preview/" with "./" in the instruction to normalize it.
    let adjustedInstruction = instruction.replace(/apps\/preview\//g, "")

    // Double check: if instruction refers to "src/App.tsx", and we are in "apps/preview", it is fine.
    // If it refers to "apps/preview/src/App.tsx", removing the prefix makes it "src/App.tsx". Correct.

    const safeInstruction = adjustedInstruction.replace(/"/g, '\\"')

    // Change log level to INFO to reduce noise, but keep some visibility
    const fullCommand = envPrefix
      ? `${envPrefix} GEMINI_LOG_LEVEL=INFO gemini ${args.join(" ")} "${safeInstruction}"`
      : `GEMINI_LOG_LEVEL=INFO gemini ${args.join(" ")} "${safeInstruction}"`

    // Smart Log Processing
    const cleanLog = (text: string) => text.replace(/\x1B\[\d+m/g, "").trim()

    const processLog = async (text: string) => {
      if (!text) return

      // Handle stream-json chunks (might be partial JSON or multiple objects)
      // Note: For now, we still treat it as text because gemini CLI might mix stdout types or raw logs?
      // Actually, stream-json usually means NDJSON.

      const lines = text.split("\n")

      for (const rawLine of lines) {
        const line = cleanLog(rawLine)
        if (line.length < 2) continue

        // Try to parse JSON events
        if (line.startsWith("{") && line.endsWith("}")) {
          try {
            const event = JSON.parse(line)

            // Handle Tool Use Events
            if (event.type === "tool_use") {
              const toolName = event.tool_name || ""
              const params = event.parameters || {}

              // Deterministic Log Mapping
              if (toolName === "read_file") {
                await logger.info(`📖 Reading ${params.file_path || "file"}...`)
                continue
              }
              if (toolName === "replace" || toolName === "write_file") {
                await logger.info(
                  `📝 Updating ${params.file_path || "file"}...`
                )
                continue
              }
              if (toolName === "run_shell_command") {
                const cmd = params.command || ""
                const shortCmd =
                  cmd.length > 50 ? cmd.substring(0, 47) + "..." : cmd
                await logger.info(`💻 Running ${shortCmd}`)
                continue
              }
              if (
                toolName.includes("search") ||
                toolName.includes("find") ||
                toolName.includes("list")
              ) {
                await logger.info(`🔍 Searching codebase...`)
                continue
              }
              // Default fallback for other tools
              await logger.info(`Using tool ${toolName}...`)
              continue
            }

            // Handle generic log messages
            if (
              event.type === "log" ||
              (event.type === "message" && !event.role)
            ) {
              if (event.message) {
                await logger.info(event.message)
              }
              continue
            }

            // Ignore other event types like 'message' (chat history sync) or 'tool_result' (verbose)
            continue
          } catch (e) {
            // Not valid JSON, treat as text
          }
        }

        const lower = line.toLowerCase()

        // 1. Filter Noise
        if (lower.includes("recording metric for phase")) continue
        if (lower.includes("http request") || lower.includes("http response"))
          continue
        if (lower.startsWith("debug:")) continue
        if (lower.startsWith("trace:")) continue
        if (line.includes("[STARTUP]")) continue
        if (line.includes("StartupProfiler")) continue

        // Filter raw JSON dumps that weren't caught above
        if (line.startsWith("{") || line.startsWith("}")) continue
        if (line.startsWith('"') && line.includes(":")) continue

        // 2. Translate Technical Events -> Friendly Logs
        if (
          lower.includes("executing tool") ||
          lower.includes("calling tool")
        ) {
          if (lower.includes("read_file")) {
            await logger.info("📖 Reading file content...")
            continue
          }
          if (lower.includes("write_file") || lower.includes("replace_")) {
            await logger.info("📝 Writing code changes...")
            continue
          }
          if (
            lower.includes("find") ||
            lower.includes("search") ||
            lower.includes("list_")
          ) {
            await logger.info("🔍 Searching codebase...")
            continue
          }
          if (lower.includes("run_shell") || lower.includes("command")) {
            await logger.info("💻 Running terminal command...")
            continue
          }
        }

        // 3. Pass through specific error/info that seems relevant
        if (lower.includes("error") || lower.includes("fail")) {
          if (lower.includes("file not found")) {
            await logger.info(`⚠️ File check failed: ${line}`)
          } else {
            await logger.info(line)
          }
          continue
        }

        // 4. Default clean log
        if (!line.match(/^\[.*?\]/)) {
          await logger.info(line)
        }
      }
    }

    await logger.info("Analyzing requirements...")

    let result = await runStreamingCommandInSandbox(
      sandbox,
      "sh",
      ["-c", fullCommand],
      {
        onStdout: (chunk) => processLog(chunk.toString()),
        onStderr: (chunk) => processLog(chunk.toString()),
      }
    )

    // If that fails with tool registry error, try with different approval modes
    if (
      !result.success &&
      result.error?.includes("Tool") &&
      result.error?.includes("not found in registry")
    ) {
      await logger.info("Retrying with auto_edit approval mode...")
      const fallbackArgs = []
      if (selectedModel) {
        fallbackArgs.push("-m", selectedModel)
      }
      fallbackArgs.push("--approval-mode", "auto_edit") // Auto-approve edit tools only
      fallbackArgs.push("-o", "text") // Use text output instead of JSON
      // Don't add instruction to array - add it quoted separately

      const fallbackCommand = envPrefix
        ? `${envPrefix} gemini ${fallbackArgs.join(" ")} "${safeInstruction}"`
        : `gemini ${fallbackArgs.join(" ")} "${safeInstruction}"`
      result = await runCommandInSandbox(sandbox, "sh", ["-c", fallbackCommand])

      // If still failing, try the most basic approach
      if (
        !result.success &&
        result.error?.includes("Tool") &&
        result.error?.includes("not found in registry")
      ) {
        await logger.info("Retrying with minimal flags...")
        const minimalArgs = selectedModel ? ["-m", selectedModel] : []
        const minimalCommand = envPrefix
          ? `${envPrefix} gemini ${minimalArgs.join(" ")} "${safeInstruction}"`
          : `gemini ${minimalArgs.join(" ")} "${safeInstruction}"`
        result = await runCommandInSandbox(sandbox, "sh", [
          "-c",
          minimalCommand,
        ])
      }
    }

    // Check if result is valid before accessing properties
    if (!result) {
      const errorMsg = "Gemini CLI execution failed - no result returned"
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: "gemini",
        changesDetected: false,
      }
    }

    // Log the output
    if (result.output && result.output.trim()) {
      // logger.info automatically redacts now
      await logger.info(result.output.trim())
    }

    if (!result.success && result.error) {
      await logger.error(result.error)
    }

    // Log more details for debugging
    await logger.info("Gemini CLI execution completed")

    // Check if any files were modified
    // Use -u to see individual files in untracked directories
    const gitStatusCheck = await runAndLogCommand(sandbox, logger, "git", [
      "status",
      "--porcelain",
      "-u",
    ])
    const hasChanges =
      gitStatusCheck.success && (gitStatusCheck.output?.trim().length ?? 0) > 0

    if (gitStatusCheck.success && !hasChanges) {
      await logger.info(
        'Debug: valid git status but no changes found. Output: "' +
          gitStatusCheck.output +
          '"'
      )
    }

    const durationMs = Date.now() - startTime
    const duration =
      durationMs > 1000
        ? `${(durationMs / 1000).toFixed(1)}s`
        : `${durationMs}ms`

    if (result.success || result.exitCode === 0) {
      // Log additional debugging info if no changes were made
      if (!hasChanges) {
        await logger.info("No changes detected. Checking if files exist...")
        // Check if common files exist
        await runAndLogCommand(sandbox, logger, "find", [
          ".",
          "-name",
          "README*",
          "-o",
          "-name",
          "readme*",
        ])
        await runAndLogCommand(sandbox, logger, "ls", ["-la"])
      }

      return {
        success: true,
        output: `Gemini CLI executed successfully${hasChanges ? " (Changes detected)" : " (No changes made)"}`,
        agentResponse: result.output || "No detailed response available",
        cliName: "gemini",
        changesDetected: !!hasChanges,
        error: undefined,
        // @ts-ignore
        duration,
      }
    } else {
      // Handle known error patterns
      return {
        success: false,
        error: `Gemini CLI failed (exit code ${result.exitCode}): ${result.error || "No error message"}`,
        agentResponse: result.output,
        cliName: "gemini",
        changesDetected: !!hasChanges,
        // @ts-ignore
        duration,
      }
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to execute Gemini CLI in sandbox"
    return {
      success: false,
      error: errorMessage,
      cliName: "gemini",
      changesDetected: false,
    }
  }
}
