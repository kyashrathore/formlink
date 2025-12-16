import { spawn } from "node:child_process"
import path from "node:path"

export class LocalSandbox {
  private cwd: string
  public sandboxId = "local-dev"

  constructor(targetDir: string = "../../apps/preview") {
    // Resolve relative to CWD (which is apps/formcraft root)
    this.cwd = path.resolve(process.cwd(), targetDir)
  }

  async runCommand(options: {
    cmd: string
    args: string[]
    stdout?: any
    stderr?: any
    env?: Record<string, string>
  }) {
    const { cmd, args, env } = options

    // Improve visibility into what is running
    console.warn(
      `[LocalSandbox] Running: ${cmd} ${args[0]} ... (full args hidden)`
    )

    return new Promise<{
      exitCode: number
      stdout: string | (() => Promise<string>)
      stderr: string | (() => Promise<string>)
    }>((resolve, reject) => {
      let child
      try {
        child = spawn(cmd, args, {
          cwd: this.cwd,
          stdio: "pipe",
          env: { ...process.env, ...env, FORCE_COLOR: "1" },
        })
      } catch (e) {
        // Command not found or other spawn error
        return resolve({
          exitCode: 127,
          stdout: "",
          stderr: String(e),
        })
      }

      let stdoutData = ""
      let stderrData = ""

      child.stdout?.on("data", (data) => {
        const chunk = data.toString()
        stdoutData += chunk
        // Stream back to real process stdout if requested (shim behavior)
        if (options.stdout && typeof options.stdout.write === "function") {
          options.stdout.write(chunk)
        }
      })

      child.stderr?.on("data", (data) => {
        const chunk = data.toString()
        stderrData += chunk
        if (options.stderr && typeof options.stderr.write === "function") {
          options.stderr.write(chunk)
        }
      })

      child.on("error", (err) => {
        stderrData += err.message
        resolve({
          exitCode: 1,
          stdout: stdoutData,
          stderr: stderrData,
        })
      })

      child.on("close", (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout: stdoutData,
          stderr: stderrData,
        })
      })
    })
  }

  // Shim for domain method
  domain(port: number = 5173) {
    return `http://localhost:${port}`
  }
}
