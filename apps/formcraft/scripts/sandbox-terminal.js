#!/usr/bin/env node
/*
  Sandbox Terminal Helper
  - Connect to an existing Vercel Sandbox by sandboxId
  - Tail common log files from inside the sandbox
  - Accept commands from local stdin and execute in the sandbox while logs continue streaming

  Usage:
    node apps/formcraft/scripts/sandbox-terminal.js --id <sandboxId> [--team <teamId>] [--project <projectId>] [--token <token>] [--no-tail]

  Env fallback:
    SANDBOX_VERCEL_TOKEN or VERCEL_OIDC_TOKEN
    SANDBOX_VERCEL_TEAM_ID
    SANDBOX_VERCEL_PROJECT_ID
*/

const { Sandbox } = require("@vercel/sandbox")
const readline = require("readline")
const fs = require("fs")
const path = require("path")

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--id" || a === "-i") args.id = argv[++i]
    else if (a === "--team") args.teamId = argv[++i]
    else if (a === "--project") args.projectId = argv[++i]
    else if (a === "--token") args.token = argv[++i]
    else if (a === "--no-tail") args.noTail = true
    else if (a === "--logs") args.logs = argv[++i]
    else if (!args.id && !a.startsWith("--")) args.id = a
  }
  return args
}

function requireEnvOrArg(name, argVal) {
  const envMap = {
    token: process.env.SANDBOX_VERCEL_TOKEN || process.env.VERCEL_OIDC_TOKEN,
    teamId: process.env.SANDBOX_VERCEL_TEAM_ID,
    projectId: process.env.SANDBOX_VERCEL_PROJECT_ID,
  }
  if (argVal) return argVal
  if (name in envMap && envMap[name]) return envMap[name]
  return undefined
}

async function runTail(sandbox, filesPattern) {
  const pattern = filesPattern || "/tmp/*.log"
  const cmd = [
    "sh",
    "-lc",
    // List candidate logs; tail any that exist; re-open on rotation
    `LOGS=$(ls -1 ${pattern} 2>/dev/null || true); \
     if [ -z "$LOGS" ]; then echo "[tail] no log files matching ${pattern}"; fi; \
     for f in $LOGS; do echo "[tail] === $f ==="; done; \
     tail -n 200 -F $LOGS 2>/dev/null || true`,
  ]
  // Fire-and-forget; stream to local stdout/stderr
  sandbox
    .runCommand({
      cmd: cmd[0],
      args: cmd.slice(1),
      stdout: process.stdout,
      stderr: process.stderr,
    })
    .catch(() => {})
}

async function main() {
  // Load env from local .env files if present
  const tryLoadEnv = (p) => {
    try {
      if (fs.existsSync(p)) {
        const text = fs.readFileSync(p, "utf8")
        text.split(/\r?\n/).forEach((line) => {
          const l = line.trim()
          if (!l || l.startsWith("#")) return
          const m = l.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
          if (!m) return
          const key = m[1]
          let val = m[2]
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }
          if (process.env[key] == null) process.env[key] = val
        })
      }
    } catch {}
  }
  const cwd = process.cwd()
  tryLoadEnv(path.join(cwd, ".env.local"))
  tryLoadEnv(path.join(cwd, ".env"))
  // Also try repo root relative to this script
  const repoRoot = path.resolve(__dirname, "../../../..")
  if (repoRoot !== cwd) {
    tryLoadEnv(path.join(repoRoot, ".env.local"))
    tryLoadEnv(path.join(repoRoot, ".env"))
  }

  const args = parseArgs(process.argv)
  if (!args.id) {
    console.error(
      "Usage: sandbox-terminal --id <sandboxId> [--team <teamId>] [--project <projectId>] [--token <token>] [--no-tail]"
    )
    process.exit(1)
  }

  const token = requireEnvOrArg("token", args.token)
  const teamId = requireEnvOrArg("teamId", args.teamId)
  const projectId = requireEnvOrArg("projectId", args.projectId)

  if (!token || !teamId || !projectId) {
    console.error(
      "Missing sandbox credentials. Provide --token/--team/--project or set SANDBOX_VERCEL_TOKEN (or VERCEL_OIDC_TOKEN), SANDBOX_VERCEL_TEAM_ID, SANDBOX_VERCEL_PROJECT_ID"
    )
    process.exit(1)
  }

  console.log(
    `[sbx] connecting to sandbox ${args.id} (team=${teamId}, project=${projectId})`
  )
  let sandbox
  try {
    sandbox = await Sandbox.get({
      sandboxId: args.id,
      teamId,
      projectId,
      token,
    })
  } catch (err) {
    console.error("[sbx] failed to connect:", err?.message || err)
    process.exit(1)
  }

  const domain = sandbox.domain(5173)
  const previewUrl = domain.startsWith("http") ? domain : `https://${domain}`
  console.log(`[sbx] connected. dev/preview: ${previewUrl}`)

  if (!args.noTail) {
    console.log(
      "[sbx] tailing /tmp/*.log (showing last 200 lines, then follow)"
    )
    runTail(sandbox, args.logs)
  }

  // Interactive REPL for commands
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "sandbox> ",
  })
  rl.prompt()

  rl.on("line", async (line) => {
    const trimmed = line.trim()
    if (!trimmed) return rl.prompt()
    if (trimmed === ":q" || trimmed === ":quit" || trimmed === ":exit") {
      rl.close()
      return
    }
    if (trimmed === ":help") {
      console.log("Commands:")
      console.log("  :help           show help")
      console.log("  :q | :quit      exit terminal")
      console.log("  :tail           re-run tail of /tmp/*.log")
      console.log(
        '  any other text  executes as `sh -lc "..."` inside the sandbox'
      )
      rl.prompt()
      return
    }
    if (trimmed === ":tail") {
      runTail(sandbox, args.logs)
      rl.prompt()
      return
    }

    const prefix =
      'export BUN_INSTALL="$HOME/.bun"; export PATH="$BUN_INSTALL/bin:$PATH";'
    const command = `${prefix} ${trimmed}`
    console.log(`[sbx] $ ${trimmed}`)
    try {
      const result = await sandbox.runCommand({
        cmd: "sh",
        args: ["-lc", command],
        stdout: process.stdout,
        stderr: process.stderr,
      })
      console.log(`[sbx] exit ${result.exitCode}`)
    } catch (err) {
      console.error("[sbx] command error:", err?.message || err)
    }
    rl.prompt()
  })

  rl.on("close", () => {
    console.log("\n[sbx] bye")
    process.exit(0)
  })
}

main().catch((err) => {
  console.error("[sbx] unexpected error:", err)
  process.exit(1)
})
