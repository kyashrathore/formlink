import { Sandbox } from "@vercel/sandbox"

export interface CommandResult {
  success: boolean
  exitCode?: number
  output?: string
  error?: string
  streamingLogs?: unknown[]
  command?: string
}

export interface StreamingCommandOptions {
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
  onJsonLine?: (jsonData: unknown) => void
}

const debug =
  process.env.CODEGEN_DEBUG === "true" || process.env.NODE_ENV !== "production"

export async function runCommandInSandbox(
  sandbox: Sandbox,
  command: string,
  args: string[] = []
): Promise<CommandResult> {
  try {
    const result = await sandbox.runCommand({
      cmd: command,
      args,
      // Mirror CLI behavior: always forward to server stdout/stderr in Node runtime
      stdout: process.stdout,
      stderr: process.stderr,
    })

    // Handle stdout and stderr properly
    let stdout = ""
    let stderr = ""

    try {
      stdout = await (result.stdout as () => Promise<string>)()
    } catch {
      // Failed to read stdout
    }

    try {
      stderr = await (result.stderr as () => Promise<string>)()
    } catch {
      // Failed to read stderr
    }

    const fullCommand =
      args.length > 0 ? `${command} ${args.join(" ")}` : command

    return {
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      output: stdout,
      error: stderr,
      command: fullCommand,
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Command execution failed"
    const fullCommand =
      args.length > 0 ? `${command} ${args.join(" ")}` : command
    return {
      success: false,
      error: errorMessage,
      command: fullCommand,
    }
  }
}

export async function runStreamingCommandInSandbox(
  sandbox: Sandbox,
  command: string,
  args: string[] = [],
  options: StreamingCommandOptions = {}
): Promise<CommandResult> {
  try {
    // Create proxy streams that call our callbacks
    const { PassThrough } = await import("node:stream")

    const stdoutStream = new PassThrough()
    stdoutStream.on("data", (chunk) => {
      const text = chunk.toString()
      if (options.onStdout) options.onStdout(text)
      if (process.stdout) process.stdout.write(chunk)
    })

    const stderrStream = new PassThrough()
    stderrStream.on("data", (chunk) => {
      const text = chunk.toString()
      if (options.onStderr) options.onStderr(text)
      if (process.stderr) process.stderr.write(chunk)
    })

    const result = await sandbox.runCommand({
      cmd: command,
      args,
      stdout: stdoutStream,
      stderr: stderrStream,
    })

    let stdout = ""
    let stderr = ""

    try {
      // stdout is always a function that returns a promise
      if (typeof result.stdout === "function") {
        stdout = await result.stdout()
        // Process the complete output for JSON lines
        if (options.onJsonLine) {
          const lines = stdout.split("\n")
          for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine) {
              try {
                const jsonData = JSON.parse(trimmedLine)
                options.onJsonLine(jsonData)
              } catch {
                // Not valid JSON, ignore
              }
            }
          }
        }
        if (options.onStdout) {
          options.onStdout(stdout)
        }
      }
    } catch {
      // Failed to read stdout
    }

    try {
      // stderr is always a function that returns a promise
      if (typeof result.stderr === "function") {
        stderr = await result.stderr()
        if (options.onStderr) {
          options.onStderr(stderr)
        }
      }
    } catch {
      // Failed to read stderr
    }

    const fullCommand =
      args.length > 0 ? `${command} ${args.join(" ")}` : command

    return {
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      output: stdout,
      error: stderr,
      command: fullCommand,
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to run streaming command in sandbox"
    const fullCommand =
      args.length > 0 ? `${command} ${args.join(" ")}` : command
    return {
      success: false,
      error: errorMessage,
      command: fullCommand,
    }
  }
}
