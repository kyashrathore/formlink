export interface ActionExecutionErrorOptions {
  status?: number
  code?: string
  provider?: "usesend" | "composio"
  cause?: unknown
}

export class ActionExecutionError extends Error {
  status: number
  code?: string
  provider?: "usesend" | "composio"
  cause?: unknown

  constructor(message: string, options: ActionExecutionErrorOptions = {}) {
    super(message)
    this.name = "ActionExecutionError"
    this.status = options.status ?? 500
    this.code = options.code
    this.provider = options.provider
    this.cause = options.cause
  }
}

export function isActionExecutionError(
  error: unknown
): error is ActionExecutionError {
  return error instanceof ActionExecutionError
}
