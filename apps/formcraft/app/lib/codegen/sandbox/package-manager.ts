import { Sandbox } from "@vercel/sandbox"
import { StreamLogger } from "../stream-logger"
import { runCommandInSandbox } from "./commands"

// Helper function to detect package manager based on lock files
export type PackageManager = "bun" | "pnpm" | "yarn" | "npm"

export async function detectPackageManager(
  sandbox: Sandbox,
  logger: StreamLogger
): Promise<PackageManager> {
  const bunLockCheck = await runCommandInSandbox(sandbox, "test", [
    "-f",
    "bun.lockb",
  ])
  if (bunLockCheck.success) {
    await logger.info("Detected bun.lockb; selecting Bun package manager")
    return "bun"
  }

  // Check for lock files in order of preference
  const pnpmLockCheck = await runCommandInSandbox(sandbox, "test", [
    "-f",
    "pnpm-lock.yaml",
  ])
  if (pnpmLockCheck.success) {
    await logger.info("Detected pnpm package manager")
    return "pnpm"
  }

  const yarnLockCheck = await runCommandInSandbox(sandbox, "test", [
    "-f",
    "yarn.lock",
  ])
  if (yarnLockCheck.success) {
    await logger.info("Detected yarn package manager")
    return "yarn"
  }

  const npmLockCheck = await runCommandInSandbox(sandbox, "test", [
    "-f",
    "package-lock.json",
  ])
  if (npmLockCheck.success) {
    await logger.info("Detected npm package manager")
    return "npm"
  }

  // Default to Bun if no lock file found (Bun + Vite template)
  await logger.info("No lock file found, defaulting to bun install")
  return "bun"
}

// Helper function to install dependencies with the appropriate package manager
export async function installDependencies(
  sandbox: Sandbox,
  packageManager: PackageManager,
  logger: StreamLogger
): Promise<{ success: boolean; error?: string }> {
  let installCommand: string[] = ["npm", "install"]
  let logMessage = "Attempting npm install"

  switch (packageManager) {
    case "bun":
      installCommand = [
        "sh",
        "-lc",
        'export BUN_INSTALL="$HOME/.bun"; export PATH="$BUN_INSTALL/bin:$PATH"; bun install',
      ]
      logMessage = "Attempting bun install"
      break
    case "pnpm":
      // Configure pnpm to use /tmp/pnpm-store to avoid large files in project
      const configStore = await runCommandInSandbox(sandbox, "pnpm", [
        "config",
        "set",
        "store-dir",
        "/tmp/pnpm-store",
      ])
      if (!configStore.success) {
        await logger.error("Failed to configure pnpm store directory")
      } else {
        await logger.info("Configured pnpm store directory")
      }

      installCommand = ["pnpm", "install", "--frozen-lockfile"]
      logMessage = "Attempting pnpm install"
      break
    case "yarn":
      installCommand = ["yarn", "install", "--frozen-lockfile"]
      logMessage = "Attempting yarn install"
      break
    case "npm":
      installCommand = ["npm", "install", "--no-audit", "--no-fund"]
      logMessage = "Attempting npm install"
      break
  }

  await logger.info(logMessage)

  const [cmd, ...args] = installCommand
  if (!cmd) {
    await logger.error("No package manager command specified")
    return { success: false, error: "No package manager command specified" }
  }

  const installResult = await runCommandInSandbox(sandbox, cmd, args)

  if (installResult.success) {
    await logger.info("Node.js dependencies installed")
    return { success: true }
  } else {
    await logger.error("Package manager install failed")

    if (installResult.exitCode !== undefined) {
      await logger.error("Install failed with exit code")
      if (installResult.output) await logger.error("Install stdout available")
      if (installResult.error) await logger.error("Install stderr available")
    } else {
      await logger.error("Install error occurred")
    }

    return { success: false, error: installResult.error }
  }
}
