import { Sandbox } from "@vercel/sandbox"
import { runCommandInSandbox } from "../codegen/sandbox/commands"
import { StreamLogger } from "../codegen/stream-logger"

export interface CloudflareDeployOptions {
  sandbox: Sandbox
  logger: StreamLogger
  branchName: string
  projectName: string
  accountId: string
  apiToken: string
}

export interface CloudflareDeployResult {
  url: string
  rawOutput: string
}

async function ensureWranglerAvailable(
  sandbox: Sandbox,
  logger: StreamLogger
): Promise<boolean> {
  const whichResult = await runCommandInSandbox(sandbox, "which", ["wrangler"])
  if (whichResult.success && whichResult.output?.includes("wrangler")) {
    await logger.info("Wrangler CLI already installed in sandbox")
    return true
  }

  await logger.info("Installing Wrangler CLI globally")
  const installResult = await runCommandInSandbox(sandbox, "npm", [
    "install",
    "-g",
    "wrangler@3",
  ])
  if (!installResult.success) {
    await logger.error("Failed to install Wrangler CLI")
    return false
  }

  await logger.info("Wrangler CLI installed successfully")
  return true
}

export async function deployWithWrangler(
  options: CloudflareDeployOptions
): Promise<CloudflareDeployResult> {
  const { sandbox, logger, branchName, projectName, accountId, apiToken } =
    options

  const ready = await ensureWranglerAvailable(sandbox, logger)
  if (!ready) {
    throw new Error("Wrangler CLI unavailable inside sandbox")
  }

  const envPrefix = `CLOUDFLARE_ACCOUNT_ID="${accountId}" CLOUDFLARE_API_TOKEN="${apiToken}"`
  const command = `${envPrefix} wrangler pages deploy dist --project-name="${projectName}" --branch="${branchName}" --commit-message="Automated Formlink codegen deploy" --commit-dirty true`

  await logger.updateStatus("deploying", "Deploying build to Cloudflare Pages")

  const result = await runCommandInSandbox(sandbox, "sh", ["-lc", command])

  if (!result.success) {
    throw new Error(result.error || "Wrangler deploy command failed")
  }

  const output = result.output || ""
  await logger.info("Wrangler deployment completed")

  const urlMatch = output.match(/https?:\/\/[^\s]+\.pages\.dev[^\s]*/)
  if (!urlMatch) {
    throw new Error("Failed to extract Pages preview URL from Wrangler output")
  }

  const previewUrl = urlMatch[0]
  await logger.emit("preview", { url: previewUrl })

  return {
    url: previewUrl,
    rawOutput: output,
  }
}
