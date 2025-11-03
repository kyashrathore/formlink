import { redactSensitiveInfo } from "./logging"

type StreamEventEmitter = (
  event: string,
  payload: unknown
) => Promise<void> | void

type LogLevel = "info" | "error" | "success" | "progress"

type StatusPayload = {
  status: string
  message?: string
  progress?: number
}

type LogPayload = {
  level: LogLevel
  message: string
}

type CommandPayload = {
  cmd: string
  args?: string[]
  exitCode?: number
}

type PushPayload = {
  branchName: string
  success: boolean
}

export class StreamLogger {
  private readonly taskId: string
  private readonly emitEvent: StreamEventEmitter
  private readonly debug: boolean

  constructor(taskId: string, emitEvent: StreamEventEmitter) {
    this.taskId = taskId
    this.emitEvent = emitEvent
    // Default to console logging in development to ensure visibility.
    // Toggle with CODEGEN_DEBUG or CODEGEN_FORCE_CONSOLE in other environments.
    this.debug =
      process.env.CODEGEN_FORCE_CONSOLE === "true" ||
      process.env.CODEGEN_DEBUG === "true" ||
      process.env.NODE_ENV !== "production"
  }

  get id(): string {
    return this.taskId
  }

  async info(message: string): Promise<void> {
    if (this.debug) {
      console.warn(`[codegen:${this.taskId}] info: ${message}`)
    }
    await this.emitLog("info", message)
  }

  async command(
    cmd: string,
    args: string[] = [],
    exitCode?: number
  ): Promise<void> {
    const payload: CommandPayload = {
      cmd: redactSensitiveInfo(cmd),
    }

    if (args.length > 0) {
      payload.args = args.map((arg) => redactSensitiveInfo(arg))
    }

    if (typeof exitCode === "number") {
      payload.exitCode = exitCode
    }

    if (this.debug) {
      console.warn(
        `[codegen:${this.taskId}] command: ${payload.cmd} ${payload.args?.join(" ") ?? ""}`
      )
    }

    await this.emit("command", payload)
  }

  async error(message: string): Promise<void> {
    if (this.debug) {
      console.error(`[codegen:${this.taskId}] error: ${message}`)
    }
    await this.emitLog("error", message)
  }

  async success(message: string): Promise<void> {
    if (this.debug) {
      console.warn(`[codegen:${this.taskId}] success: ${message}`)
    }
    await this.emitLog("success", message)
  }

  async updateProgress(progress: number, message?: string): Promise<void> {
    const payload: StatusPayload = {
      status: "progress",
      progress,
    }

    if (message) {
      payload.message = redactSensitiveInfo(message)
    }

    if (this.debug) {
      console.warn(
        `[codegen:${this.taskId}] progress: ${progress}% ${message ?? ""}`
      )
    }

    await this.emit("status", payload)
  }

  async updateStatus(status: string, message?: string): Promise<void> {
    const payload: StatusPayload = {
      status,
    }

    if (message) {
      payload.message = redactSensitiveInfo(message)
    }

    if (this.debug) {
      console.warn(
        `[codegen:${this.taskId}] status: ${status} ${message ?? ""}`
      )
    }

    await this.emit("status", payload)
  }

  async logPushResult(payload: PushPayload): Promise<void> {
    if (this.debug) {
      console.warn(
        `[codegen:${this.taskId}] push: ${payload.branchName} success=${payload.success}`
      )
    }
    await this.emit("push", {
      branchName: redactSensitiveInfo(payload.branchName),
      success: payload.success,
    })
  }

  async emit(event: string, payload: unknown): Promise<void> {
    try {
      await this.emitEvent(event, payload)
    } catch (error) {
      console.error("[StreamLogger] Failed to emit event", { event, error })
    }
  }

  private async emitLog(level: LogLevel, message: string): Promise<void> {
    const payload: LogPayload = {
      level,
      message: redactSensitiveInfo(message),
    }

    await this.emit("log", payload)
  }
}

export type { StreamEventEmitter, CommandPayload, LogPayload, StatusPayload }
