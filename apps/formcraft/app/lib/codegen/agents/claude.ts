import { Sandbox } from "@vercel/sandbox"
import { runCommandInSandbox } from "../sandbox/commands"
import { AgentExecutionResult } from "../sandbox/types"
import { StreamLogger } from "../stream-logger"

function escapeForShell(input: string): string {
  return JSON.stringify(input)
}

async function runAndLogCommand(
  sandbox: Sandbox,
  logger: StreamLogger,
  command: string,
  args: string[] = []
) {
  await logger.command(command, args)
  const result = await runCommandInSandbox(sandbox, command, args)

  if (result.output?.trim()) {
    await logger.info(result.output.trim())
  }

  if (!result.success && result.error) {
    await logger.error(result.error)
  }

  return result
}

async function ensureClaudeConfig(
  sandbox: Sandbox,
  logger: StreamLogger,
  model?: string
) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    await logger.error(
      "ANTHROPIC_API_KEY is not configured; Claude CLI cannot authenticate"
    )
    return
  }

  const selectedModel = model || "claude-sonnet-4.1"
  const configScript = `mkdir -p $HOME/.config/claude && cat <<'EOF' > $HOME/.config/claude/config.json
{
  "api_key": "${apiKey}",
  "default_model": "${selectedModel}"
}
EOF`

  await runAndLogCommand(sandbox, logger, "sh", ["-lc", configScript])
}

export async function installClaudeCLI(
  sandbox: Sandbox,
  logger: StreamLogger,
  model?: string
): Promise<boolean> {
  const existing = await runCommandInSandbox(sandbox, "which", ["claude"])
  if (existing.success && existing.output?.includes("claude")) {
    await logger.info("Claude CLI already installed")
    await ensureClaudeConfig(sandbox, logger, model)
    return true
  }

  await logger.info("Installing Claude CLI via npm")
  const installResult = await runAndLogCommand(sandbox, logger, "npm", [
    "install",
    "-g",
    "@anthropic-ai/claude-code",
  ])
  if (!installResult.success) {
    await logger.error("Claude CLI installation failed")
    return false
  }

  await logger.info("Claude CLI installed successfully")
  await ensureClaudeConfig(sandbox, logger, model)
  return true
}

export async function executeClaudeInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: StreamLogger,
  selectedModel?: string
): Promise<AgentExecutionResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return {
        success: false,
        error: "ANTHROPIC_API_KEY is required to run Claude CLI",
        cliName: "claude",
        changesDetected: false,
      }
    }

    const ready = await installClaudeCLI(sandbox, logger, selectedModel)
    if (!ready) {
      return {
        success: false,
        error: "Claude CLI could not be installed",
        cliName: "claude",
        changesDetected: false,
      }
    }

    const modelToUse = selectedModel || "claude-sonnet-4.1"
    const envPrefix = `ANTHROPIC_API_KEY="${apiKey}"`
    const quotedInstruction = escapeForShell(instruction)
    const command = `${envPrefix} claude --model "${modelToUse}" --dangerously-skip-permissions --output-format stream-json --verbose ${quotedInstruction}`

    await logger.updateStatus("executing_agent", "Running Claude CLI")
    const execution = await runAndLogCommand(sandbox, logger, "sh", [
      "-lc",
      command,
    ])

    if (!execution.success) {
      return {
        success: false,
        error: execution.error || "Claude CLI execution failed",
        cliName: "claude",
        changesDetected: false,
      }
    }

    const gitStatus = await runAndLogCommand(sandbox, logger, "git", [
      "status",
      "--porcelain",
    ])
    const changesDetected = Boolean(gitStatus.output?.trim())

    return {
      success: true,
      agentResponse: execution.output,
      cliName: "claude",
      changesDetected,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to execute Claude CLI"
    return {
      success: false,
      error: message,
      cliName: "claude",
      changesDetected: false,
    }
  }
}
