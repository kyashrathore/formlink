import { Sandbox } from "@vercel/sandbox"
import { nanoid } from "nanoid"
import { redactSensitiveInfo } from "../logging"
import { StreamLogger } from "../stream-logger"
import { runCommandInSandbox } from "./commands"
import {
  getGitAuthHeader,
  normalizeRepoUrl,
  validateEnvironmentVariables,
} from "./config"
import {
  detectPackageManager,
  installDependencies,
  PackageManager,
} from "./package-manager"
import { registerSandbox } from "./registry"
import { SandboxConfig, SandboxResult } from "./types"

const DEFAULT_TIMEOUT_MINUTES = 60
const DEFAULT_RUNTIME = "node22"
const DEFAULT_PORT = 5173
const DEFAULT_BASE_BRANCH = "main"
const BUN_ENV_EXPORT =
  'export BUN_INSTALL="\$HOME/.bun"; export PATH="\$BUN_INSTALL/bin:\$PATH"'

function sanitizeBranchName(branch: string): string {
  return branch
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function buildFallbackBranchName(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  const randomSuffix = nanoid(6)
  return `agent/${timestamp}-${randomSuffix}`
}

async function runAndLogCommand(
  sandbox: Sandbox,
  command: string,
  args: string[],
  logger: StreamLogger
) {
  const result = await runCommandInSandbox(sandbox, command, args)

  if (result?.output?.trim()) {
    await logger.info(redactSensitiveInfo(result.output.trim()))
  }

  if (result && !result.success && result.error) {
    await logger.error(redactSensitiveInfo(result.error))
  }

  return result
}

async function runGitCommand(
  sandbox: Sandbox,
  args: string[],
  logger: StreamLogger,
  authHeader?: string
): Promise<Awaited<ReturnType<typeof runCommandInSandbox>>> {
  const gitArgs = authHeader
    ? ["-c", `http.extraHeader=${authHeader}`, ...args]
    : args
  return runAndLogCommand(sandbox, "git", gitArgs, logger)
}

async function ensureBunAvailable(sandbox: Sandbox, logger: StreamLogger) {
  const bunCheck = await runCommandInSandbox(sandbox, "sh", [
    "-lc",
    "command -v bun >/dev/null 2>&1",
  ])
  if (bunCheck.success) {
    await logger.info("Bun runtime detected")
    return
  }

  await logger.info("Bun runtime not found, installing...")
  const installResult = await runAndLogCommand(
    sandbox,
    "sh",
    ["-lc", "curl -fsSL https://bun.sh/install | bash"],
    logger
  )

  if (!installResult.success) {
    await logger.error(
      "Failed to install Bun automatically; falling back to npm if required"
    )
  } else {
    await logger.info("Bun installation completed")
  }
}

async function configureGitIdentity(
  sandbox: Sandbox,
  logger: StreamLogger,
  name: string,
  email: string
) {
  await runAndLogCommand(sandbox, "git", ["config", "user.name", name], logger)
  await runAndLogCommand(
    sandbox,
    "git",
    ["config", "user.email", email],
    logger
  )
}

async function ensureGitignore(sandbox: Sandbox, logger: StreamLogger) {
  const gitignoreExists = await runCommandInSandbox(sandbox, "test", [
    "-f",
    ".gitignore",
  ])

  if (gitignoreExists.success) {
    await runCommandInSandbox(sandbox, "sh", [
      "-c",
      'grep -q "\.pnpm-store" .gitignore || echo ".pnpm-store" >> .gitignore',
    ])
    await runCommandInSandbox(sandbox, "sh", [
      "-c",
      'grep -q "node_modules" .gitignore || echo "node_modules" >> .gitignore',
    ])
    await runCommandInSandbox(sandbox, "sh", [
      "-c",
      'grep -q "dist" .gitignore || echo "dist" >> .gitignore',
    ])
  } else {
    await runAndLogCommand(
      sandbox,
      "sh",
      ["-c", 'printf ".pnpm-store\nnode_modules\ndist\n" > .gitignore'],
      logger
    )
  }

  await logger.info("Git ignore rules configured")
}

async function installNodeDependencies(
  sandbox: Sandbox,
  logger: StreamLogger,
  packageManager: PackageManager,
  authHeader?: string
) {
  await logger.updateStatus(
    "installing_deps",
    "Installing project dependencies"
  )
  const installResult = await installDependencies(
    sandbox,
    packageManager,
    logger
  )

  if (!installResult.success && packageManager !== "npm") {
    await logger.info("Primary package manager failed; attempting npm fallback")
    const fallback = await installDependencies(sandbox, "npm", logger)
    if (!fallback.success) {
      await logger.error(
        "npm fallback failed; proceeding without dependency install"
      )
    }
  }

  // Refresh lockfiles from origin to avoid drift when skipping install (best effort)
  if (authHeader) {
    await runGitCommand(
      sandbox,
      ["fetch", "origin", "--depth", "1"],
      logger,
      authHeader
    )
  }
}

export async function createSandbox(
  config: SandboxConfig,
  logger: StreamLogger
): Promise<SandboxResult> {
  try {
    await logger.updateStatus(
      "validating_env",
      "Validating environment configuration"
    )
    console.warn("[codegen/sandbox] validate env")

    if (config.onProgress) {
      await config.onProgress(15, "Validating environment variables...")
    }

    if (config.onCancellationCheck && (await config.onCancellationCheck())) {
      await logger.info("Task was cancelled before sandbox creation")
      return { success: false, cancelled: true }
    }

    const githubToken =
      config.githubToken ?? process.env.CODEGEN_GITHUB_TOKEN ?? null
    const repoInput = config.repoUrl || process.env.CODEGEN_GITHUB_REPO

    const envValidation = validateEnvironmentVariables(
      config.selectedAgent,
      githubToken,
      config.apiKeys
    )
    if (!envValidation.valid) {
      throw new Error(envValidation.error || "Environment validation failed")
    }

    if (!repoInput) {
      throw new Error("CODEGEN_GITHUB_REPO is not configured")
    }

    const normalizedRepoUrl = normalizeRepoUrl(repoInput)
    const authHeader = getGitAuthHeader(githubToken)
    const baseBranch = sanitizeBranchName(
      config.baseBranch || DEFAULT_BASE_BRANCH
    )
    const targetBranchRaw = config.preDeterminedBranchName || ""
    const targetBranch = targetBranchRaw
      ? sanitizeBranchName(targetBranchRaw)
      : sanitizeBranchName(buildFallbackBranchName())

    const timeoutMinutesRaw = config.timeout
      ? parseInt(config.timeout.replace(/[^0-9]/g, ""), 10)
      : DEFAULT_TIMEOUT_MINUTES
    const timeoutMinutes =
      Number.isFinite(timeoutMinutesRaw) && timeoutMinutesRaw > 0
        ? timeoutMinutesRaw
        : DEFAULT_TIMEOUT_MINUTES
    const timeoutMs = Math.min(timeoutMinutes * 60 * 1000, 2700000)

    await logger.updateStatus(
      "creating_sandbox",
      "Creating sandbox environment"
    )
    console.warn("[codegen/sandbox] creating sandbox via @vercel/sandbox")
    if (config.onProgress) {
      await config.onProgress(25, "Creating sandbox environment...")
    }

    const usingOidc =
      !process.env.SANDBOX_VERCEL_TOKEN && !!process.env.VERCEL_OIDC_TOKEN
    await logger.info(
      `Creating Vercel sandbox (team=${process.env.SANDBOX_VERCEL_TEAM_ID ? "set" : "unset"}, project=${process.env.SANDBOX_VERCEL_PROJECT_ID ? "set" : "unset"}, token=${usingOidc ? "oidc" : process.env.SANDBOX_VERCEL_TOKEN ? "pat" : "unset"})`
    )

    const sandbox = await Sandbox.create({
      teamId: process.env.SANDBOX_VERCEL_TEAM_ID,
      projectId: process.env.SANDBOX_VERCEL_PROJECT_ID,
      token: process.env.SANDBOX_VERCEL_TOKEN || process.env.VERCEL_OIDC_TOKEN,
      timeout: timeoutMs,
      ports: config.ports || [DEFAULT_PORT],
      runtime: config.runtime || DEFAULT_RUNTIME,
      resources: { vcpus: config.resources?.vcpus || 4 },
    })

    registerSandbox(config.taskId, sandbox, Boolean(config.keepAlive))
    await logger.updateStatus("sandbox_created", "Sandbox created successfully")
    if (config.onProgress) {
      await config.onProgress(35, "Sandbox created; preparing repository...")
    }

    if (config.onCancellationCheck && (await config.onCancellationCheck())) {
      await logger.info("Task was cancelled after sandbox creation")
      return { success: false, cancelled: true }
    }

    await logger.updateStatus(
      "cloning_repository",
      "Cloning template repository"
    )
    console.warn("[codegen/sandbox] cloning repository", { baseBranch })
    await runAndLogCommand(sandbox, "sh", ["-c", "rm -rf ./* ./.??*"], logger)

    // Match the CLI: embed GitHub token in HTTPS URL to avoid http.extraHeader issues inside sandbox
    let credentialedRepoUrl = normalizedRepoUrl.trim()
    try {
      if (githubToken) {
        const u = new URL(normalizedRepoUrl)
        // Use x-access-token for GitHub token auth over HTTPS
        u.username = process.env.CODEGEN_GITHUB_USER || "x-access-token"
        u.password = githubToken
        credentialedRepoUrl = u.toString().trim()
      }
    } catch {
      // fall back to normalizedRepoUrl
    }

    const redactedRepoUrl = githubToken
      ? credentialedRepoUrl.replace(githubToken, "***")
      : credentialedRepoUrl

    const cloneArgs = [
      "clone",
      "--depth",
      "1",
      "--branch",
      baseBranch,
      credentialedRepoUrl,
      ".",
    ]

    await logger.command("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      baseBranch,
      redactedRepoUrl,
      ".",
    ])

    const cloneResult = await runAndLogCommand(
      sandbox,
      "git",
      cloneArgs,
      logger
    )
    if (!cloneResult.success) {
      const err = (cloneResult.error || "").toLowerCase()
      if (err.includes("not found")) {
        await logger.error(
          "Git clone failed: repository not found. Check CODEGEN_GITHUB_REPO and that CODEGEN_GITHUB_TOKEN has access (repo scope)."
        )
      }
      throw new Error("Failed to clone template repository")
    }

    if (config.onProgress) {
      await config.onProgress(50, "Repository cloned; preparing workspace...")
    }

    const gitName =
      config.gitAuthorName ||
      process.env.CODEGEN_GIT_AUTHOR_NAME ||
      "Formlink Codegen Bot"
    const gitEmail =
      config.gitAuthorEmail ||
      process.env.CODEGEN_GIT_AUTHOR_EMAIL ||
      "bot@formlink.ai"
    await configureGitIdentity(sandbox, logger, gitName, gitEmail)
    await ensureGitignore(sandbox, logger)

    if (config.onCancellationCheck && (await config.onCancellationCheck())) {
      await logger.info("Task was cancelled after repository checkout")
      return { success: false, cancelled: true }
    }

    await ensureBunAvailable(sandbox, logger)

    if (config.installDependencies !== false) {
      const packageJsonExists = await runCommandInSandbox(sandbox, "test", [
        "-f",
        "package.json",
      ])
      if (packageJsonExists.success) {
        const packageManager = await detectPackageManager(sandbox, logger)
        await installNodeDependencies(
          sandbox,
          logger,
          packageManager,
          authHeader
        )
        if (config.onProgress) {
          await config.onProgress(
            70,
            `Dependencies installed with ${packageManager}`
          )
        }
      } else {
        await logger.info(
          "No package.json detected; skipping dependency installation"
        )
      }
    } else {
      await logger.info("Dependency installation skipped per configuration")
    }

    // Start dev server early so the sandbox domain serves content immediately
    // This enables the dashboard to embed the preview while codegen runs.
    try {
      await logger.updateStatus(
        "starting_dev",
        "Starting Bun dev server on port 5173"
      )
      // Start Vite directly to avoid scripts that pass --open (xdg-open not available in sandbox)
      const startDev =
        'export BUN_INSTALL="\$HOME/.bun"; export PATH="\$BUN_INSTALL/bin:\$PATH"; nohup bunx vite --host 0.0.0.0 --port 5173 > /tmp/dev.log 2>&1 & echo \$! > /tmp/dev.pid'
      await runAndLogCommand(sandbox, "sh", ["-lc", startDev], logger)
      await logger.info("Dev server started (port 5173)")
    } catch (e) {
      await logger.info(
        "Dev server start skipped or failed; preview may appear after build"
      )
    }

    await logger.updateStatus(
      "preparing_branch",
      `Preparing branch ${targetBranch}`
    )
    if (config.onProgress) {
      await config.onProgress(80, `Preparing branch ${targetBranch}`)
    }

    // Avoid remote operations here; create a local branch only.
    // We are already on baseBranch from the cloned repo.
    await logger.info(
      `Creating local branch ${targetBranch} from ${baseBranch}`
    )
    const checkoutBase = await runGitCommand(
      sandbox,
      ["checkout", baseBranch],
      logger
    )
    if (!checkoutBase.success) {
      throw new Error(`Failed to checkout base branch ${baseBranch}`)
    }

    const createLocalBranch = await runGitCommand(
      sandbox,
      ["checkout", "-B", targetBranch],
      logger
    )
    if (!createLocalBranch.success) {
      throw new Error(`Failed to create local branch ${targetBranch}`)
    }

    if (config.onProgress) {
      await config.onProgress(90, `Branch ${targetBranch} ready`)
    }

    const domain = sandbox.domain(
      (config.ports && config.ports[0]) || DEFAULT_PORT
    )

    return {
      success: true,
      sandbox,
      domain,
      branchName: targetBranch,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred"
    await logger.error(`Sandbox setup failed: ${redactSensitiveInfo(message)}`)
    return {
      success: false,
      error: message,
    }
  }
}
