#!/usr/bin/env node
/* eslint-disable no-console */
const { Sandbox } = require("@vercel/sandbox")

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

function normalizeRepo(repo) {
  const raw = String(repo || "").trim()
  if (!raw) return raw
  // Handle git@ style by converting to https
  // git@github.com:owner/repo.git -> https://github.com/owner/repo.git
  const gitSshMatch = raw.match(/^git@github\.com:(.*)$/)
  if (gitSshMatch) {
    const path = gitSshMatch[1]
    return `https://github.com/${path}`
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
  return `https://github.com/${raw}.git`
}

function buildCredentialedRepo(repo, token) {
  const url = new URL(String(repo || "").trim())
  // Preserve username if caller already provided one; otherwise set GitHub-recommended sentinel
  if (!url.username) {
    url.username = process.env.CODEGEN_GITHUB_USER || "x-access-token"
  }
  url.password = token
  return url.toString()
}

async function runCommandWithLogs(sandbox, cmd, args, options = {}) {
  const { displayArgs = args, ...rest } = options
  console.log(`[sandbox] $ ${cmd} ${displayArgs.join(" ")}`)
  const result = await sandbox.runCommand({
    cmd,
    args,
    stdout: process.stdout,
    stderr: process.stderr,
    ...rest,
  })
  if (result.exitCode !== 0) {
    throw new Error(
      `${cmd} ${displayArgs.join(" ")} failed with exit ${result.exitCode}`
    )
  }
  return result
}

async function main() {
  const repo = normalizeRepo(requiredEnv("CODEGEN_GITHUB_REPO"))
  const githubToken = requiredEnv("CODEGEN_GITHUB_TOKEN")
  const repoWithToken = buildCredentialedRepo(repo, githubToken)
  const redactedRepo = repoWithToken.replace(githubToken, "***")

  const formId = process.env.FORM_ID || "manual"
  const baseBranch = process.env.CODEGEN_BASE_BRANCH || "main"
  const branchName = process.env.CODEGEN_BRANCH_NAME || `sandbox-${formId}`
  const timeoutMinutes = Number(process.env.SANDBOX_TIMEOUT || "60")
  const port = Number(process.env.SANDBOX_PORT || "5173")

  const sandboxConfig = {
    timeout: Math.min(timeoutMinutes * 60 * 1000, 45 * 60 * 1000),
    ports: [port],
    runtime: "node22",
    resources: { vcpus: 4 },
  }

  if (process.env.SANDBOX_VERCEL_TEAM_ID)
    sandboxConfig.teamId =
      process.env.SANDBOX_VERCEL_TEAM_ID || "contactyashrathore-3214s-projects"
  if (process.env.SANDBOX_VERCEL_PROJECT_ID)
    sandboxConfig.projectId =
      process.env.SANDBOX_VERCEL_PROJECT_ID ||
      "prj_M2XZWnxaxGB0atJJaIr4NzR0v8ph"
  if (process.env.SANDBOX_VERCEL_TOKEN)
    sandboxConfig.token = process.env.SANDBOX_VERCEL_TOKEN

  console.log("[sandbox] creating sandbox with config", sandboxConfig)
  const sandbox = await Sandbox.create(sandboxConfig)
  console.log("[sandbox] id:", sandbox.sandboxId)

  const sandboxDomain = sandbox.domain(port)
  const previewUrl = sandboxDomain.startsWith("http")
    ? sandboxDomain
    : `https://${sandboxDomain}`
  console.log(`[sandbox] Preview domain: ${previewUrl}`)

  await runCommandWithLogs(sandbox, "rm", ["-rf", "*"])

  await runCommandWithLogs(
    sandbox,
    "git",
    ["clone", "--depth", "1", "--branch", baseBranch, repoWithToken, "."],
    {
      displayArgs: [
        "clone",
        "--depth",
        "1",
        "--branch",
        baseBranch,
        redactedRepo,
        ".",
      ],
    }
  )

  let remoteHasBranch = false
  const fetchResult = await sandbox.runCommand({
    cmd: "git",
    args: ["fetch", "origin", branchName],
    stdout: process.stdout,
    stderr: process.stderr,
  })
  if (fetchResult.exitCode === 0) {
    remoteHasBranch = true
  }

  if (remoteHasBranch) {
    await runCommandWithLogs(sandbox, "git", [
      "checkout",
      "-B",
      branchName,
      `origin/${branchName}`,
    ])
  } else {
    await runCommandWithLogs(sandbox, "git", [
      "checkout",
      "-B",
      branchName,
      `origin/${baseBranch}`,
    ])
  }

  console.log("[sandbox] installing bun runtime if needed")
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-lc",
      "command -v bun >/dev/null 2>&1 || curl -fsSL https://bun.sh/install | bash",
    ],
    stdout: process.stdout,
    stderr: process.stderr,
  })

  await runCommandWithLogs(sandbox, "sh", [
    "-lc",
    'export BUN_INSTALL="$HOME/.bun"; export PATH="$BUN_INSTALL/bin:$PATH"; bun install',
  ])

  console.log("\n[sandbox] starting dev server (CTRL+C to stop)")
  console.log(`[sandbox] opening ${previewUrl} once booted\n`)

  const devProcess = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-lc",
      'export BUN_INSTALL="$HOME/.bun"; export PATH="$BUN_INSTALL/bin:$PATH"; bun run dev -- --host 0.0.0.0 --port ' +
        port,
    ],
    stdout: process.stdout,
    stderr: process.stderr,
  })

  if (devProcess.exitCode !== 0) {
    console.error("[sandbox] dev server exited with code", devProcess.exitCode)
  }

  await sandbox.stop()
  console.log("[sandbox] stopped")
}

main().catch((err) => {
  console.error("[sandbox] error", err)
  process.exit(1)
})
