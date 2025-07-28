/**
 * Utility functions for safe serialization of complex objects
 */

/**
 * Removes circular references from an agent event for safe serialization
 * @param agentEvent - The agent event that may contain circular references
 * @returns A safe version of the agent event without circular references
 */
export function sanitizeAgentEventForSerialization<
  T extends Record<string, any>,
>(agentEvent: T): T {
  if (!agentEvent || typeof agentEvent !== "object") {
    return agentEvent
  }

  // Create a deep copy to avoid mutating the original
  const safeEvent = { ...agentEvent }

  // Handle the known circular reference in agentState
  if (
    "data" in safeEvent &&
    safeEvent.data &&
    typeof safeEvent.data === "object" &&
    "agentState" in safeEvent.data &&
    safeEvent.data.agentState
  ) {
    ;(safeEvent as any).data = {
      ...safeEvent.data,
      agentState: {
        ...safeEvent.data.agentState,
        // Remove the circular reference that points back to events
        _agentEvents: undefined,
      },
    }
  }

  return safeEvent
}

/**
 * Generic function to remove circular references from any object
 * Uses a WeakSet to track visited objects and prevent infinite recursion
 */
export function removeCircularReferences<T>(
  obj: T,
  visited = new WeakSet()
): T {
  if (obj === null || typeof obj !== "object") {
    return obj
  }

  if (visited.has(obj as object)) {
    return "[Circular Reference]" as T
  }

  visited.add(obj as object)

  if (Array.isArray(obj)) {
    return obj.map((item) => removeCircularReferences(item, visited)) as T
  }

  const result = {} as T
  for (const [key, value] of Object.entries(obj)) {
    ;(result as any)[key] = removeCircularReferences(value, visited)
  }

  visited.delete(obj as object)
  return result
}
