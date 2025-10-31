import { Sandbox } from "@vercel/sandbox"
import { runCommandInSandbox } from "../sandbox/commands"
import { AgentExecutionResult } from "../sandbox/types"
import { StreamLogger } from "../stream-logger"

function escapeForShell(input: string): string {
  // POSIX-safe single-quote wrapping; handles backticks and most special chars
  return "'" + String(input).replace(/'/g, "'\\''") + "'"
}

async function runAndLogCommand(
  sandbox: Sandbox,
  logger: StreamLogger,
  command: string,
  args: string[] = [],
  opts?: { displayCmd?: string; displayArgs?: string[] }
) {
  await logger.command(opts?.displayCmd ?? command, opts?.displayArgs ?? args)
  const result = await runCommandInSandbox(sandbox, command, args)

  if (result.output?.trim()) {
    await logger.info(result.output.trim())
  }

  if (!result.success && result.error) {
    await logger.error(result.error)
  }

  return result
}

async function ensureCodexConfig(
  sandbox: Sandbox,
  logger: StreamLogger,
  _model?: string
) {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  const apiKey = gatewayKey || openaiKey
  if (!apiKey) {
    await logger.error(
      "Neither AI_GATEWAY_API_KEY nor OPENAI_API_KEY is configured; Codex CLI cannot authenticate"
    )
    return false
  }

  const isGateway = Boolean(gatewayKey) || apiKey.startsWith("vck_")
  // Always use gpt-5-codex for Codex agent
  const selectedModel = "gpt-5-codex"

  const baseConfig = `model = "${selectedModel}"
model_provider = "${isGateway ? "vercel-ai-gateway" : "openai"}"
`

  const providerConfig = isGateway
    ? `
[model_providers.vercel-ai-gateway]
name = "Vercel AI Gateway"
base_url = "https://ai-gateway.vercel.sh/v1"
env_key = "AI_GATEWAY_API_KEY"
wire_api = "chat"
`
    : `
[model_providers.openai]
name = "OpenAI"
base_url = "https://api.openai.com/v1"
env_key = "OPENAI_API_KEY"
wire_api = "responses"
`

  const configToml = `${baseConfig}${providerConfig}
[debug]
log_requests = true
`

  const b64 = Buffer.from(configToml, "utf8").toString("base64")
  const configScript = `mkdir -p "$HOME/.codex" && echo '${b64}' | base64 -d > "$HOME/.codex/config.toml"`

  const result = await runAndLogCommand(sandbox, logger, "sh", [
    "-lc",
    configScript,
  ])
  return result.success
}

export async function installCodexCLI(
  sandbox: Sandbox,
  logger: StreamLogger
): Promise<boolean> {
  const existing = await runCommandInSandbox(sandbox, "which", ["codex"])
  if (existing.success && existing.output?.includes("codex")) {
    await logger.info("Codex CLI already installed")
    return true
  }

  await logger.info("Installing Codex CLI via npm")
  const installResult = await runAndLogCommand(sandbox, logger, "npm", [
    "install",
    "-g",
    "@openai/codex",
  ])
  if (!installResult.success) {
    await logger.error("Codex CLI installation failed")
    return false
  }

  await logger.info("Codex CLI installed successfully")
  return true
}

export async function executeCodexInSandbox(
  sandbox: Sandbox,
  instruction: string,
  logger: StreamLogger,
  selectedModel?: string
): Promise<AgentExecutionResult> {
  try {
    const hasGatewayKey = Boolean(process.env.AI_GATEWAY_API_KEY)
    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY)

    if (!hasGatewayKey && !hasOpenAIKey) {
      return {
        success: false,
        error:
          "AI_GATEWAY_API_KEY or OPENAI_API_KEY is required to run Codex CLI",
        cliName: "codex",
        changesDetected: false,
      }
    }

    const ready = await installCodexCLI(sandbox, logger)
    if (!ready) {
      return {
        success: false,
        error: "Codex CLI could not be installed",
        cliName: "codex",
        changesDetected: false,
      }
    }

    const configReady = await ensureCodexConfig(sandbox, logger, selectedModel)
    if (!configReady) {
      return {
        success: false,
        error: "Codex configuration could not be created",
        cliName: "codex",
        changesDetected: false,
      }
    }

    // Short diagnostics: version + config header (redacted)
    await runAndLogCommand(sandbox, logger, "codex", ["--version"])
    await runAndLogCommand(sandbox, logger, "sh", [
      "-lc",
      "{ echo '[codex-config]'; sed -n '1,12p' \"$HOME/.codex/config.toml\" | sed 's/AI_GATEWAY_API_KEY/AI_GATEWAY_API_KEY=*** /; s/OPENAI_API_KEY/OPENAI_API_KEY=*** /'; } || true",
    ])

    const quotedInstruction = escapeForShell(instruction)
    const command = `codex exec --dangerously-bypass-approvals-and-sandbox ${quotedInstruction}`
    // Export both envs so whichever env_key the TOML references is available
    const envParts: string[] = []
    if (process.env.AI_GATEWAY_API_KEY)
      envParts.push(`AI_GATEWAY_API_KEY=\"${process.env.AI_GATEWAY_API_KEY}\"`)
    if (process.env.OPENAI_API_KEY)
      envParts.push(`OPENAI_API_KEY=\"${process.env.OPENAI_API_KEY}\"`)
    const envVars = envParts.join(" ")

    await logger.updateStatus("executing_agent", "Running Codex CLI")
    const script = envVars ? `${envVars} ${command}` : command
    const masked = script
      .replace(/AI_GATEWAY_API_KEY=\"[^\"]*\"/, 'AI_GATEWAY_API_KEY="***"')
      .replace(/OPENAI_API_KEY=\"[^\"]*\"/, 'OPENAI_API_KEY="***"')
      .replace(
        /codex exec[\s\S]*/,
        "codex exec --dangerously-bypass-approvals-and-sandbox <<omitted>>"
      )
    const execution = await runAndLogCommand(
      sandbox,
      logger,
      "sh",
      ["-lc", script],
      { displayCmd: "sh", displayArgs: ["-lc", masked] }
    )

    if (!execution.success) {
      return {
        success: false,
        error: execution.error || "Codex CLI execution failed",
        cliName: "codex",
        changesDetected: false,
      }
    }

    // Treat only substantive changes as success; ignore .gitignore noise
    const gitStatus = await runAndLogCommand(sandbox, logger, "sh", [
      "-lc",
      "git status --porcelain | grep -Ev '^[ MARDU?]{2} \\.gitignore$' || true",
    ])
    const changesDetected = Boolean(gitStatus.output?.trim())

    return {
      success: true,
      agentResponse: execution.output,
      cliName: "codex",
      changesDetected,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to execute Codex CLI"
    return {
      success: false,
      error: message,
      cliName: "codex",
      changesDetected: false,
    }
  }
}
