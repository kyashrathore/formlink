type EventData =
  | { message?: string }
  | { input?: string; userId?: string; inputType?: string }
  | {
      current_step?: string
      _last_completed_node?: string
      formMetadata?: { title?: string }
      tasksToPersist?: unknown[]
      generatedQuestionSchemas?: unknown[]
      journeyScript?: string
      resultPageGenerationPrompt?: string
    }
  | {
      message?: string
      taskId?: string
      output?: string | { title?: string } | Record<string, unknown>
      error?: string | unknown
    }
  | {
      details?: { event_source?: string } | unknown
      questionIndex?: number
      totalQuestions?: number
      questionTitle?: string
    }
  | null
  | undefined
  | Record<string, unknown>

export function formatEventData(eventName: string, data: EventData): string {
  if (data === null || data === undefined) {
    return "No data"
  }

  const hasProperty = (obj: any, prop: string): boolean => {
    return obj && typeof obj === "object" && prop in obj
  }

  switch (eventName) {
    case "sse_stream_init":
    case "realtime_subscribed":
      return hasProperty(data, "message")
        ? (data as any).message || JSON.stringify(data)
        : JSON.stringify(data)
    case "agent_init":
      return `Input: "${hasProperty(data, "input") ? (data as any).input : ""}", User: ${hasProperty(data, "userId") ? (data as any).userId?.substring(0, 8) : ""}, Type: ${hasProperty(data, "inputType") ? (data as any).inputType : ""}`
    case "agent_start":
      return `Input: "${hasProperty(data, "input") ? (data as any).input : ""}", User: ${hasProperty(data, "userId") ? (data as any).userId?.substring(0, 8) : ""}, Type: ${hasProperty(data, "inputType") ? (data as any).inputType : ""}`
    case "agent_state_update": {
      const summary = []
      if (hasProperty(data, "current_step") && (data as any).current_step)
        summary.push(`Step: ${(data as any).current_step}`)
      else if (
        hasProperty(data, "_last_completed_node") &&
        (data as any)._last_completed_node
      )
        summary.push(`Last Node: ${(data as any)._last_completed_node}`)
      if (
        hasProperty(data, "formMetadata") &&
        (data as any).formMetadata?.title
      )
        summary.push(`Form: "${(data as any).formMetadata.title}"`)
      if (hasProperty(data, "tasksToPersist") && (data as any).tasksToPersist)
        summary.push(`Tasks: ${(data as any).tasksToPersist.length}`)
      if (
        hasProperty(data, "generatedQuestionSchemas") &&
        (data as any).generatedQuestionSchemas
      )
        summary.push(
          `Questions: ${(data as any).generatedQuestionSchemas.length}`
        )
      if (hasProperty(data, "journeyScript") && (data as any).journeyScript)
        summary.push("Journey script with strategy generated")
      if (
        hasProperty(data, "resultPageGenerationPrompt") &&
        (data as any).resultPageGenerationPrompt
      )
        summary.push("Result page prompt generated")
      if (summary.length === 0) return "State updated (see details)"
      return summary.join(", ")
    }
    case "task_started":
    case "task_failed":
    case "task_completed": {
      let taskSummary =
        (hasProperty(data, "message") ? (data as any).message : "") ||
        `Task ${hasProperty(data, "taskId") ? (data as any).taskId?.substring(0, 8) : ""}: ${eventName.replace("task_", "")}`

      if (
        eventName === "task_completed" &&
        hasProperty(data, "output") &&
        (data as any).output
      ) {
        const output = (data as any).output
        if (typeof output === "string") {
          taskSummary += ` - Output: "${output.substring(0, 50)}${output.length > 50 ? "..." : ""}"`
        } else if (output?.title) {
          taskSummary += ` - Output: Question "${output.title}"`
        } else if (
          typeof output === "object" &&
          Object.keys(output).length > 0
        ) {
          taskSummary += ` - Output: (object)`
        }
      }

      if (
        eventName === "task_failed" &&
        hasProperty(data, "error") &&
        (data as any).error
      ) {
        const error = (data as any).error
        const errorMessage =
          typeof error === "string" ? error : JSON.stringify(error)
        taskSummary += ` - Error: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? "..." : ""}`
      }
      return taskSummary
    }
    case "agent_complete":
      return `Agent processing complete. ${hasProperty(data, "resultPageGenerationPrompt") && (data as any).resultPageGenerationPrompt ? "Result page prompt generated." : ""}`
    case "agent_error":
      return `Error: ${(hasProperty(data, "message") ? (data as any).message : "") || (hasProperty(data, "error") ? (data as any).error : "") || JSON.stringify(data)}`
    case "agent_end":
      return "Agent processing ended."
    case "db_forms_intermediate_save_warning":
    case "db_forms_final_save_error":
    case "sse_history_error":
    case "realtime_error":
      return `Warning/Error: ${hasProperty(data, "message") ? (data as any).message || JSON.stringify(data) : JSON.stringify(data)}`
    case "agent_warning":
      if (
        hasProperty(data, "details") &&
        (data as any).details?.event_source ===
          "metadata_generator_journey_script"
      ) {
        return (
          (hasProperty(data, "message") ? (data as any).message : "") ||
          "Form journey script generated"
        )
      }
      return (
        (hasProperty(data, "message") ? (data as any).message : "") ||
        `Warning: ${JSON.stringify(hasProperty(data, "details") ? (data as any).details : data)}`
      )
    case "question_schema_generated":
      return (
        (hasProperty(data, "message") ? (data as any).message : "") ||
        `Generated schema for Q${hasProperty(data, "questionIndex") ? (data as any).questionIndex + 1 : "?"}/${hasProperty(data, "totalQuestions") ? (data as any).totalQuestions : "?"}: "${hasProperty(data, "questionTitle") ? (data as any).questionTitle : "Unknown"}"`
      )
    default:
      if (typeof data === "object" && Object.keys(data).length > 0) {
        return `Event data: ${Object.keys(data).slice(0, 3).join(", ")}${Object.keys(data).length > 3 ? "..." : ""}`
      }
      return JSON.stringify(data)
  }
}
