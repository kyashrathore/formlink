export function normalizePersistedParts(rawParts: any[], fallbackText: string) {
  if (!Array.isArray(rawParts) || rawParts.length === 0) {
    return fallbackText ? [{ type: "text", text: fallbackText }] : []
  }
  return rawParts.map((p: any) => {
    if (p?.type === "tool-invocation") {
      return p // already in UIMessage v5-compatible shape with results
    }
    const isFunctionCall = p?.toolCallType === "function" && p?.toolName
    const isToolCall = p?.type === "tool-call" && p?.toolName
    if (isFunctionCall || isToolCall) {
      let parsedArgs: any = isFunctionCall ? p.args : p.input
      try {
        if (typeof parsedArgs === "string") parsedArgs = JSON.parse(parsedArgs)
      } catch {}
      return {
        type: "tool-invocation",
        toolInvocation: {
          state: "result",
          step: 1,
          toolCallId: p.toolCallId || p.id,
          toolName: p.toolName,
          args: parsedArgs,
          // No result available in legacy rows; UI will show ✓ Completed without details
        },
      }
    }
    return p
  })
}

export function isToolInvocationPart(
  p: any
): p is { type: "tool-invocation"; toolInvocation: any } {
  return (
    p &&
    typeof p === "object" &&
    p.type === "tool-invocation" &&
    p.toolInvocation
  )
}
